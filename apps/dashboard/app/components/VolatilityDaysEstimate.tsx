"use client";

import { useState, useEffect } from "react";

const CLOB_BASE = "https://clob.polymarket.com";
const HISTORY_DAYS = 7;

type HistoryPoint = { t: number; p: number };

function usePriceHistory(tokenId: string | null) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tokenId?.trim()) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const startTs = Math.floor(Date.now() / 1000) - HISTORY_DAYS * 24 * 60 * 60;
    fetch(`${CLOB_BASE}/prices-history?market=${encodeURIComponent(tokenId)}&startTs=${startTs}`)
      .then((r) => r.json())
      .then((data: { history?: HistoryPoint[] }) => {
        if (cancelled) return;
        const h = Array.isArray(data?.history) ? data.history : [];
        setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return { history, loading, error };
}

/** Compute daily volatility (std of day-over-day price changes) from price history. */
function computeDailyVolatility(history: HistoryPoint[]): number | null {
  if (history.length < 2) return null;
  // Group by day (UTC), take last price of each day
  const byDay = new Map<number, number>();
  for (const { t, p } of history) {
    const day = Math.floor(t / 86400) * 86400;
    byDay.set(day, p);
  }
  const days = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]);
  if (days.length < 2) return null;
  const changes: number[] = [];
  for (let i = 1; i < days.length; i++) {
    changes.push(Math.abs(days[i]![1] - days[i - 1]![1]));
  }
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((a, c) => a + (c - mean) ** 2, 0) / changes.length;
  const std = Math.sqrt(variance);
  return std > 0 ? std : null;
}

/** Estimate spread at target price. Spread tends to scale with p*(1-p) (uncertainty).
 * Widest at 50¢, tighter near 0¢ or 100¢. */
function estimateSpreadAtPrice(
  currentSpread: number,
  currentPrice: number,
  targetPrice: number
): number {
  const f = (p: number) => Math.max(0.01, p * (1 - p));
  const ratio = f(targetPrice) / f(currentPrice);
  return Math.max(0.005, currentSpread * ratio);
}

/** Estimate days to reach target bid from current, given daily mid volatility.
 * Target is the bid (exit). Uses current spread for entry, estimated spread at target for exit. */
function estimateDaysToReach(
  currentPrice: number,
  targetBid: number,
  dailyVolatility: number,
  spread?: number | null
): number {
  const sp = spread ?? 0;
  const currentBid = currentPrice - sp / 2;
  const spreadAtTarget = spread != null && spread > 0
    ? estimateSpreadAtPrice(spread, currentPrice, targetBid)
    : 0;
  const midNeededForBid = targetBid + spreadAtTarget / 2;
  const delta = Math.abs(midNeededForBid - currentPrice);
  if (dailyVolatility <= 0 || delta <= 0) return 0;
  const days = delta / dailyVolatility;
  return Math.max(0.5, Math.min(365, Math.round(days * 10) / 10));
}

type Props = {
  /** Which asset: "yes" or "no" — drives token and probability used. */
  asset: "yes" | "no";
  /** Called when user toggles YES/NO. */
  onAssetChange: (pos: "yes" | "no") => void;
  yesId: string | null;
  noId: string | null;
  probabilityYes: number | null;
  probabilityNo: number | null;
  /** Ask-bid spread for YES token (added to mid for effective buy price). */
  yesSpread?: number | null;
  /** Ask-bid spread for NO token. */
  noSpread?: number | null;
  defaultTargetPrice?: number;
};

export function VolatilityDaysEstimate({
  asset,
  onAssetChange,
  yesId,
  noId,
  probabilityYes,
  probabilityNo,
  yesSpread,
  noSpread,
  defaultTargetPrice = 90,
}: Props) {
  const [targetInput, setTargetInput] = useState(defaultTargetPrice.toString());
  const tokenId = asset === "yes" ? yesId : noId;
  const probability = asset === "yes" ? probabilityYes : probabilityNo;
  const spread = asset === "yes" ? yesSpread : noSpread;
  const { history, loading, error } = usePriceHistory(tokenId);

  const toDec = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? (v > 1 ? v / 100 : v) : null;

  const currentPrice = toDec(probability);
  const spreadNorm = toDec(spread);
  const targetParsed = parseFloat(targetInput);
  const targetNorm = Number.isFinite(targetParsed) && targetParsed >= 0 && targetParsed <= 100
    ? targetParsed / 100
    : null;

  const dailyVol = computeDailyVolatility(history);
  const daysEstimate =
    currentPrice != null &&
    targetNorm != null &&
    dailyVol != null &&
    dailyVol > 0
      ? estimateDaysToReach(currentPrice, targetNorm, dailyVol, spreadNorm)
      : null;

  if (!tokenId) return null;

  const assetLabel = asset === "yes" ? "YES" : "NO";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2">
      <button
        type="button"
        role="switch"
        aria-label="Volatility asset (YES or NO)"
        title={`Volatility for ${asset.toUpperCase()} — click to switch`}
        onClick={() => onAssetChange(asset === "yes" ? "no" : "yes")}
        className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200 ${
          asset === "yes"
            ? "bg-emerald-500/20 text-emerald-400 shadow-sm ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
            : "bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/30 hover:bg-red-500/30"
        }`}
      >
        <span className="text-[10px] font-bold leading-tight">{asset.toUpperCase()}</span>
      </button>
      <span className="text-xs text-slate-500 self-center">Volatility</span>
      {!loading && !error && history.length >= 2 && dailyVol != null && (
        <span className="text-xs text-slate-400 font-mono tabular-nums" title={`Daily volatility (σ) of ${assetLabel} price`}>
          {(dailyVol * 100).toFixed(2)}¢
        </span>
      )}
      <span className="text-xs text-slate-400">·</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-300 tabular-nums">
          {currentPrice != null ? `${(currentPrice * 100).toFixed(1)}¢` : "—"} →
        </span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          className="w-14 rounded border border-slate-600/60 bg-slate-900/50 px-2 py-1 text-xs font-mono text-beige"
        />
        <span className="text-xs text-slate-400">¢</span>
      </div>
      {loading && (
        <span className="text-xs text-slate-500">Loading…</span>
      )}
      {!loading && (error || history.length < 2) && (
        <span className="text-xs text-slate-500">—</span>
      )}
      {!loading && !error && history.length >= 2 && daysEstimate != null && (
        <span className="font-mono text-sm font-medium text-amber-400/90 tabular-nums" title="Target = bid (price you can sell at). Uses current spread for bid = mid − spread/2.">
          → ~{daysEstimate} days
        </span>
      )}
    </div>
  );
}
