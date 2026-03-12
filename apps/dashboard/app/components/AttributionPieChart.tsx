"use client";

import { useState, useEffect } from "react";
import {
  daysToResolution,
  formatRoi,
  computeROINumeric,
  computePAROINumeric,
} from "@/lib/position-metrics";
import { MetricTooltip } from "./MetricTooltip";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { METRIC_TOOLTIPS } from "@/lib/metric-tooltips";

const CLOB_BASE = "https://clob.polymarket.com";

type Position = {
  asset: string;
  title: string;
  size: number;
  curPrice: number;
  avgPrice?: number;
  /** Current value from API - use when available for accuracy */
  currentValue?: number;
  /** Unix timestamp (seconds) of first BUY - when entry was < 24h ago, use entry price as baseline */
  entryTimestamp?: number;
  outcome: string;
  yesId?: string;
  icon?: string;
  endDate?: string;
  spread?: number | null;
};

type HistoryPoint = { t: number; p: number };

async function fetchPrice24hAgo(tokenId: string): Promise<number | null> {
  const now = Math.floor(Date.now() / 1000);
  const startTs = now - 25 * 60 * 60;
  try {
    const res = await fetch(
      `${CLOB_BASE}/prices-history?market=${encodeURIComponent(tokenId)}&startTs=${startTs}`
    );
    const data = (await res.json()) as { history?: HistoryPoint[] };
    const h = Array.isArray(data?.history) ? data.history : [];
    if (h.length < 2) return null;
    const targetTs = now - 24 * 60 * 60;
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < h.length; i++) {
      const dist = Math.abs(h[i]!.t - targetTs);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    return h[bestI]!.p;
  } catch {
    return null;
  }
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "−";
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPositionValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}k`;
  return `$${abs.toFixed(2)}`;
}

function computeCAROINumeric(
  avgPrice: number,
  days: number | null,
  spread?: number | null
): number | null {
  const buyPrice = Math.min(0.99, avgPrice + (spread ?? 0));
  if (buyPrice <= 0 || days == null || days <= 0) return null;
  const r = (1 - buyPrice) / buyPrice;
  return r * (365 / days);
}

type Slice = {
  title: string;
  pnl24h: number;
  absShare: number;
  color: string;
  priceThen: number | null;
  priceNow: number;
  /** Amount invested (size × avgPrice) */
  investedAmount: number | null;
  /** Position value - uses currentValue from API when available */
  positionValue: number;
  icon?: string;
  roi: string;
  caroi: string;
  paroi: string;
  sparkline?: { yesId: string; entryTimestamp?: number; outcome: string; avgPrice: number };
};

export function AttributionPieChart({ positions }: { positions: Position[] }) {
  const [slices, setSlices] = useState<Slice[]>([]);
  const [totalPnl24h, setTotalPnl24h] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (positions.length === 0) {
      setSlices([]);
      setTotalPnl24h(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      const now = Math.floor(Date.now() / 1000);
      const SECONDS_24H = 24 * 60 * 60;

      const promises = positions.map(async (pos) => {
        const tokenId = pos.yesId ?? pos.asset;
        const isYes = pos.outcome.toLowerCase() === "yes";
        const entryPrice =
          pos.avgPrice != null &&
          Number.isFinite(pos.avgPrice) &&
          pos.avgPrice > 0 &&
          pos.avgPrice < 1
            ? pos.avgPrice
            : null;
        const entryRecently =
          pos.entryTimestamp != null &&
          (now - pos.entryTimestamp) < SECONDS_24H;

        // When entry was < 24h ago, use entry price as baseline (you didn't hold 24h ago)
        let priceThen: number | null;
        if (entryRecently && entryPrice != null) {
          priceThen = entryPrice;
        } else {
          const price24h = await fetchPrice24hAgo(tokenId);
          priceThen = price24h != null ? (isYes ? price24h : 1 - price24h) : null;
        }

        // Prefer price derived from API currentValue when available for consistency
        const priceNow =
          pos.currentValue != null &&
          Number.isFinite(pos.currentValue) &&
          pos.size > 0
            ? pos.currentValue / pos.size
            : pos.curPrice;

        let pnl24h = 0;
        if (priceThen != null) {
          pnl24h = pos.size * (priceNow - priceThen); // value change = size × price change
        }
        const positionValue =
          pos.currentValue != null && Number.isFinite(pos.currentValue)
            ? pos.currentValue
            : pos.size * priceNow;
        const investedAmount =
          entryPrice != null ? pos.size * entryPrice : null;

        const days = daysToResolution(pos.endDate ?? "", pos.title);
        const roiNum = entryPrice != null ? computeROINumeric(entryPrice, pos.spread) : null;
        const caroiNum = entryPrice != null ? computeCAROINumeric(entryPrice, days, pos.spread) : null;
        const paroiNum = computePAROINumeric(priceNow, days, pos.spread);
        const sparkline =
          pos.yesId ?? pos.asset
            ? {
                yesId: pos.yesId ?? pos.asset,
                entryTimestamp: pos.entryTimestamp,
                outcome: pos.outcome,
                avgPrice: entryPrice ?? 0.5,
              }
            : undefined;

        return {
          title: pos.title,
          pnl24h,
          priceThen,
          priceNow,
          investedAmount,
          positionValue,
          icon: pos.icon,
          roi: roiNum != null ? formatRoi(roiNum) : "—",
          caroi: caroiNum != null ? formatRoi(caroiNum) : "—",
          paroi: Number.isFinite(paroiNum) && paroiNum > -Infinity ? formatRoi(paroiNum) : "—",
          sparkline,
        };
      });
      const results = await Promise.all(promises);
      if (cancelled) return;
      const fullTotal = results.reduce((s, r) => s + r.pnl24h, 0);
      setTotalPnl24h(fullTotal);
      const totalAbs = results.reduce((s, r) => s + Math.abs(r.pnl24h), 0);
      const MIN_SHARE = 0.02;
      const withRawShare = results.map((r) => ({
        ...r,
        rawShare: totalAbs > 0 ? Math.abs(r.pnl24h) / totalAbs : 1 / results.length,
        color: r.pnl24h >= 0 ? "#34D399" : "#F87171",
        priceThen: r.priceThen,
        priceNow: r.priceNow,
        investedAmount: r.investedAmount,
        positionValue: r.positionValue,
        icon: r.icon,
      }));
      const totalAdjusted = withRawShare.reduce(
        (s, r) => s + Math.max(r.rawShare, MIN_SHARE),
        0
      );
      const withShares = withRawShare
        .map(({ rawShare, ...r }) => ({
          ...r,
          absShare: totalAdjusted > 0 ? Math.max(rawShare, MIN_SHARE) / totalAdjusted : 1 / results.length,
        }))
        .sort((a, b) => (b.pnl24h >= 0 ? 1 : -1) - (a.pnl24h >= 0 ? 1 : -1));
      setSlices(withShares);
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [positions]);

  const cardClass =
    "h-[600px] w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

  if (loading) {
    return (
      <div className={cardClass}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Attribution (24h)
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        </div>
      </div>
    );
  }

  if (slices.length === 0) {
    return (
      <div className={cardClass}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Attribution (24h)
        </h3>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No positions
        </div>
      </div>
    );
  }

  const totalAbs = slices.reduce((s, sl) => s + sl.absShare, 0);
  if (totalAbs === 0) {
    return (
      <div className={cardClass}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Attribution (24h)
        </h3>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-slate-400">No 24h price data</p>
          <p className="text-xs text-slate-500">
            Total P&L: {formatUsd(slices.reduce((s, sl) => s + sl.pnl24h, 0))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PieChartInner slices={slices} totalPnl={totalPnl24h} />
  );
}

function formatPrice(p: number): string {
  return `${(p * 100).toFixed(2)}¢`;
}

function PieChartInner({
  slices,
  totalPnl,
}: {
  slices: Slice[];
  totalPnl: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = selected ?? hovered;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter * 0.55;

  let acc = 0;
  const paths = slices.map((sl, i) => {
    const pct = sl.absShare;
    const startAngle = acc * 2 * Math.PI - Math.PI / 2;
    acc += pct;
    const endAngle = acc * 2 * Math.PI - Math.PI / 2;
    const large = pct > 0.5 ? 1 : 0;
    const x1o = cx + rOuter * Math.cos(startAngle);
    const y1o = cy + rOuter * Math.sin(startAngle);
    const x2o = cx + rOuter * Math.cos(endAngle);
    const y2o = cy + rOuter * Math.sin(endAngle);
    const x1i = cx + rInner * Math.cos(startAngle);
    const y1i = cy + rInner * Math.sin(startAngle);
    const x2i = cx + rInner * Math.cos(endAngle);
    const y2i = cy + rInner * Math.sin(endAngle);
    const d = `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rInner} ${rInner} 0 ${large} 0 ${x1i} ${y1i} Z`;
    return { d, ...sl, i };
  });

  const activeSlice = active != null ? paths[active] : null;

  function handleSliceClick(i: number) {
    setSelected((prev) => (prev === i ? null : i));
  }

  return (
    <div className="flex h-[600px] w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
      <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Attribution (24h)
      </h3>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden">
        <div className="relative shrink-0">
          <svg width={size} height={size} className="overflow-visible">
            {paths.map(({ d, color, i }) => (
              <path
                key={i}
                d={d}
                fill={color}
                stroke="#1e293b"
                strokeWidth={2}
                className="cursor-pointer transition-all duration-200"
                opacity={active != null && active !== i ? 0.35 : 1}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleSliceClick(i)}
                style={{
                  filter: active === i ? "drop-shadow(0 0 8px rgba(255,255,255,0.3))" : undefined,
                }}
              />
            ))}
          </svg>
          {activeSlice?.icon && (
            <div
              className="absolute left-1/2 top-1/2 flex h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700/60 bg-slate-800/80 shadow-lg transition-opacity duration-200"
              style={{ zIndex: 1 }}
            >
              <img
                src={activeSlice.icon}
                alt={activeSlice.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
        <div className="min-h-[7rem] w-full min-w-0 shrink-0">
          {activeSlice ? (
            <div className="rounded-lg bg-slate-800/50 px-4 py-3 text-center transition-colors">
              {selected != null && (
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Click again to deselect</p>
              )}
              <p className="text-sm font-medium text-slate-200 leading-snug">
                {activeSlice.title}
              </p>
              {activeSlice.sparkline && (
                <div className="mt-2 flex h-10 w-full items-center justify-center">
                  <PriceHistorySparkline
                    tokenId={activeSlice.sparkline.yesId}
                    tint="yes"
                    fill
                    entryTimestamp={activeSlice.sparkline.entryTimestamp}
                    entryPrice={
                      activeSlice.sparkline.outcome.toLowerCase() === "yes"
                        ? activeSlice.sparkline.avgPrice
                        : 1 - activeSlice.sparkline.avgPrice
                    }
                  />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
                {activeSlice.investedAmount != null && activeSlice.investedAmount > 0 && (
                  <span className="font-mono text-slate-300">
                    {formatPositionValue(activeSlice.investedAmount)} invested
                  </span>
                )}
                <span className="font-mono text-slate-400">
                  {activeSlice.priceThen != null
                    ? `${formatPrice(activeSlice.priceThen)} → ${formatPrice(activeSlice.priceNow)}`
                    : `${formatPrice(activeSlice.priceNow)} now`}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.ROI} trigger="ROI" /> {activeSlice.roi}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.CAROI} trigger="CAROI" /> {activeSlice.caroi}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.PAROI} trigger="PAROI" /> {activeSlice.paroi}
                </span>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
                24h contribution
              </p>
              <p
                className={`text-base font-semibold ${
                  activeSlice.pnl24h >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatUsd(activeSlice.pnl24h)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-xs text-slate-500">Total 24h P&L</p>
              <p
                className={`mt-0.5 text-xl font-bold ${
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatUsd(totalPnl)}
              </p>
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                Click a slice to select it, or hover to preview.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
