"use client";

import { MetricTooltip } from "./MetricTooltip";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { METRIC_TOOLTIPS } from "@/lib/metric-tooltips";
import { formatRoi } from "@/lib/position-metrics";

export type Position = {
  asset: string;
  title: string;
  slug: string;
  icon: string;
  outcome: string;
  oppositeOutcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  endDate: string;
  /** Unix seconds of first BUY. */
  entryTimestamp?: number;
  /** Yes token ID for price history. */
  yesId?: string;
  /** Ask-bid spread for the outcome token (add to buy price for ROI/PAROI). */
  spread?: number | null;
};

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Compact format for USD: $1K, $100K, $1M for large values */
function formatCompactUsd(value: number, decimals = 0): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return formatUsd(value, decimals);
}

/** Compact format for raw numbers: 1K, 100K, 1M */
function formatCompactNum(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Extract date from title, e.g. "by March 15" or "March 31" */
function parseDateFromTitle(title: string): Date | null {
  const m = title.match(/(?:by\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})/i);
  if (!m) return null;
  const year = new Date().getFullYear();
  const d = new Date(`${m[1]} ${m[2]}, ${year}`);
  if (isNaN(d.getTime())) return null;
  if (d < new Date()) d.setFullYear(year + 1); // if passed, assume next year
  return d;
}

/** Days until resolution; null if endDate missing or in the past. Falls back to title when endDate empty. Uses UTC date diff. */
function daysToResolution(endDateStr: string, title?: string): number | null {
  let d: Date | null = null;
  if (endDateStr) {
    d = new Date(endDateStr);
    if (isNaN(d.getTime())) {
      const m = endDateStr.trim().replace(/,/g, "");
      const year = new Date().getFullYear();
      d = new Date(`${m} ${year}`);
      if (isNaN(d.getTime())) d = new Date(`${m} ${year + 1}`);
    }
  }
  if ((!d || isNaN(d.getTime())) && title) d = parseDateFromTitle(title);
  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  const resUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((resUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return days > 0 ? Math.max(1, days) : null;
}

/** CAROI (Cumulative): r = (P1-P0)/P0, annual_return = r * (365/T). P0=entry+spread (buy price), P1=1. */
function computeCAROI(avgPrice: number, days: number | null, spread?: number | null): string {
  const buyPrice = Math.min(0.99, avgPrice + (spread ?? 0));
  if (buyPrice <= 0) return "—";
  if (days == null || days <= 0) return "—"; // need holding period to annualize
  const r = (1 - buyPrice) / buyPrice;
  return formatRoi(r * (365 / days));
}

/** PAROI (Present): returns numeric for sorting. Uses buyPrice = curPrice + spread. */
function computePAROINumeric(curPrice: number, days: number | null, spread?: number | null): number {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0) return -Infinity;
  if (days == null || days <= 0) return -Infinity;
  const r = (1 - buyPrice) / buyPrice;
  return r * (365 / days);
}

/** PAROI (Present): r = (P1-P0)/P0, annual_return = r * (365/T). P0=current+spread (buy price), P1=1. */
function computePAROI(curPrice: number, days: number | null, spread?: number | null): string {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0) return "—";
  if (days == null || days <= 0) return "—"; // need holding period to annualize
  const r = (1 - buyPrice) / buyPrice;
  return formatRoi(r * (365 / days));
}

/** ROI: (1 - buyPrice) / buyPrice where buyPrice = quotedProbability + spread (for buy). */
function computeROI(quotedProbability: number, spread?: number | null): string {
  const buyPrice = Math.min(0.99, quotedProbability + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return "—";
  const roi = (1 - buyPrice) / buyPrice;
  if (!Number.isFinite(roi) || roi < 0) return "—";
  return formatRoi(roi);
}

export function PositionCard({
  position,
  draggable,
  onDragStart,
}: {
  position: Position;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, asset: string) => void;
}) {
  const pos = position;
  const days = daysToResolution(pos.endDate, pos.title);
  const roi = computeROI(pos.avgPrice, pos.spread);
  const caroi = computeCAROI(pos.avgPrice, days, pos.spread);
  const paroi = computePAROI(pos.curPrice, days, pos.spread);
  const probabilityYes = pos.outcome.toLowerCase() === "yes" ? pos.curPrice : 1 - pos.curPrice;
  const probabilityNo = 1 - probabilityYes;
  const isYes = pos.outcome.toLowerCase() === "yes";
  const leftPct = isYes ? probabilityYes : probabilityNo;
  const rightPct = isYes ? probabilityNo : probabilityYes;

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, pos.asset) : undefined}
      className={`flex items-center gap-3 overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <img src={pos.icon} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-medium text-white">{pos.title}</h3>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
              pos.outcome.toLowerCase() === "yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            {pos.outcome}
          </span>
          {pos.endDate && <span className="text-xs text-slate-500">{pos.endDate}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs">
          <span className="text-slate-400">
            {formatCompactNum(pos.size)} @ {(pos.avgPrice * 100).toFixed(2)}¢ | {(pos.curPrice * 100).toFixed(2)}¢
          </span>
          <span className="text-slate-300">
            {Math.abs(pos.currentValue) >= 1_000 ? formatCompactUsd(pos.currentValue, 0) : formatUsd(pos.currentValue, 2)}
          </span>
          <span
            className={`font-medium ${pos.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {pos.cashPnl >= 0 ? "+" : ""}
            {Math.abs(pos.cashPnl) >= 1_000 ? formatCompactUsd(pos.cashPnl, 0) : formatUsd(pos.cashPnl, 2)} (
            {formatPercent(pos.percentPnl)})
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <MetricTooltip content={METRIC_TOOLTIPS.ROI} trigger="ROI" /> {roi}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <MetricTooltip content={METRIC_TOOLTIPS.CAROI} trigger="CAROI" /> {caroi}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <MetricTooltip content={METRIC_TOOLTIPS.PAROI} trigger="PAROI" /> {paroi}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center w-44 h-10">
        <PriceHistorySparkline
          tokenId={pos.yesId ?? pos.asset}
          tint="yes"
          fill
          entryTimestamp={pos.entryTimestamp}
          entryPrice={isYes ? pos.avgPrice : 1 - pos.avgPrice}
        />
      </div>
      <div className="shrink-0 flex min-w-[90px] w-24 flex-col gap-0.5">
        <div className="flex justify-between gap-2 text-[11px] font-medium">
          <span className={isYes ? "text-emerald-600/90" : "text-red-600/90"}>
            {isYes ? "Yes" : "No"} {(leftPct * 100).toFixed(0)}%
          </span>
          <span className={isYes ? "text-red-600/90" : "text-emerald-600/90"}>
            {isYes ? "No" : "Yes"} {(rightPct * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-800/80 ring-1 ring-slate-700/60">
          <div
            className={`rounded-l-full min-w-0 ${isYes ? "bg-emerald-600/70" : "bg-red-600/70"}`}
            style={{ width: `${leftPct * 100}%` }}
          />
          <div
            className={`rounded-r-full min-w-0 ${isYes ? "bg-red-600/70" : "bg-emerald-600/70"}`}
            style={{ width: `${rightPct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function PositionsList({ positions }: { positions: Position[] }) {
  const sorted = [...positions].sort((a, b) => {
    const daysA = daysToResolution(a.endDate, a.title);
    const daysB = daysToResolution(b.endDate, b.title);
    const paroiA = computePAROINumeric(a.curPrice, daysA, a.spread);
    const paroiB = computePAROINumeric(b.curPrice, daysB, b.spread);
    return paroiB - paroiA; // descending: highest PAROI first
  });

  return (
    <div className="space-y-2">
      {sorted.map((pos) => (
        <PositionCard key={pos.asset} position={pos} />
      ))}
    </div>
  );
}
