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

type SparklineProps = {
  tokenId: string | null;
  className?: string;
  tint?: "yes" | "no";
  fill?: boolean;
  /** Unix timestamp (seconds) of entry - positions dot at that time on the line. */
  entryTimestamp?: number | null;
  /** Entry price (in Yes terms) - extends chart Y range; fallback for dot when no entryTimestamp. */
  entryPrice?: number | null;
};

/** Minimalistic sparkline - no axes, just illustrates price history. Use fill to take container width/height. */
export function PriceHistorySparkline({
  tokenId,
  className,
  tint = "yes",
  fill = false,
  entryTimestamp,
  entryPrice,
}: SparklineProps) {
  const { history, loading, error } = usePriceHistory(tokenId);

  if (!tokenId) return null;
  const sizeStyle = fill ? {} : { width: 72, height: 20 };
  const fillClass = fill ? "w-full h-full" : "";
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-slate-800/50 ${fillClass} ${className ?? ""}`}
        style={sizeStyle}
        title="Loading price history…"
      >
        <div className="h-1.5 w-6 animate-pulse rounded bg-slate-600" />
      </div>
    );
  }
  if (error || history.length < 2) {
    return (
      <div
        className={`rounded bg-slate-800/30 flex items-center justify-center ${fillClass} ${className ?? ""}`}
        style={sizeStyle}
        title="No price history"
      >
        <span className="text-[10px] text-slate-500">—</span>
      </div>
    );
  }

  const prices = history.map((d) => d.p);
  // Full chart range: include entry price in Y axis so it's visible when outside recent range
  let minP = Math.min(...prices);
  let maxP = Math.max(...prices);
  if (entryPrice != null && Number.isFinite(entryPrice)) {
    minP = Math.min(minP, entryPrice);
    maxP = Math.max(maxP, entryPrice);
  }
  const range = maxP - minP || 0.01;
  const w = 72;
  const h = 20;
  const pad = 2;
  const xScale = (i: number) => pad + (i / (history.length - 1)) * (w - 2 * pad);
  const yScale = (p: number) => h - pad - ((p - minP) / range) * (h - 2 * pad);
  const pathD = history
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.p)}`)
    .join(" ");
  const strokeClass = tint === "yes" ? "text-emerald-500/80" : "text-red-500/80";
  const label = tint === "yes" ? "Yes" : "No";

  // Position blue "you entered here" dot by entry time (or fallback to closest price)
  let entryDot: { cx: number; cy: number } | null = null;
  if (entryTimestamp != null && Number.isFinite(entryTimestamp)) {
    // By timing: find history point with timestamp closest to entry
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < history.length; i++) {
      const dist = Math.abs(history[i]!.t - entryTimestamp);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    entryDot = { cx: xScale(bestI), cy: yScale(history[bestI]!.p) };
  } else if (entryPrice != null && Number.isFinite(entryPrice)) {
    // Fallback: by price (closest point on line)
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < history.length; i++) {
      const dist = Math.abs(history[i]!.p - entryPrice);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    entryDot = { cx: xScale(bestI), cy: yScale(history[bestI]!.p) };
  }

  const tooltip = `${label} price: ${(prices[prices.length - 1]! * 100).toFixed(1)}%`;
  return (
    <div className={`relative ${fill ? "w-full h-full" : ""}`} style={fill ? {} : { width: w, height: h }}>
      <svg
        {...(fill ? { width: "100%", height: "100%" } : { width: w, height: h })}
        className={`rounded block ${className ?? ""}`}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-label={tooltip}
        role="img"
      >
        <title>{tooltip}</title>
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={strokeClass}
        />
      </svg>
      {entryDot != null && (
        <div
          className="absolute rounded-full bg-yellow-500 border border-yellow-700 pointer-events-none"
          style={{
            width: 6,
            height: 6,
            minWidth: 6,
            minHeight: 6,
            left: `${(entryDot.cx / w) * 100}%`,
            top: `${(entryDot.cy / h) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
