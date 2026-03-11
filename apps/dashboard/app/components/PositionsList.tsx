"use client";

import { MetricTooltip } from "./MetricTooltip";
import { METRIC_TOOLTIPS } from "@/lib/metric-tooltips";

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

/** ROI as "Xx" where 1x = 100% return; K/M/B/T for large values, capped to avoid overflow */
function formatRoiAsX(roi: number): string {
  if (roi < 0 || !Number.isFinite(roi)) return "—";
  if (roi >= 1_000_000_000_000) {
    const t = roi / 1_000_000_000_000;
    return t >= 999.9 ? "999+Tx" : `${t.toFixed(1)}Tx`;
  }
  if (roi >= 1_000_000_000) return `${(roi / 1_000_000_000).toFixed(1)}Bx`;
  if (roi >= 1_000_000) return `${(roi / 1_000_000).toFixed(1)}Mx`;
  if (roi >= 1_000) return `${(roi / 1_000).toFixed(1)}Kx`;
  if (roi >= 100) return `${roi.toFixed(1)}x`;
  if (roi >= 10) return `${roi.toFixed(1)}x`;
  if (roi >= 1) return `${roi.toFixed(2)}x`;
  return `${roi.toFixed(2)}x`;
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

/** CAROI (Cumulative): r = (P1-P0)/P0, annual_return = r * (365/T). P0=entry, P1=1. */
function computeCAROI(avgPrice: number, days: number | null): string {
  if (avgPrice <= 0) return "—";
  if (days == null || days <= 0) return "—"; // need holding period to annualize
  const r = (1 - avgPrice) / avgPrice;
  return formatRoiAsX(r * (365 / days));
}

/** PAROI (Present): returns numeric for sorting */
function computePAROINumeric(curPrice: number, days: number | null): number {
  if (curPrice <= 0) return -Infinity;
  if (days == null || days <= 0) return -Infinity;
  const r = (1 - curPrice) / curPrice;
  return r * (365 / days);
}

/** PAROI (Present): r = (P1-P0)/P0, annual_return = r * (365/T). P0=current, P1=1. */
function computePAROI(curPrice: number, days: number | null): string {
  if (curPrice <= 0) return "—";
  if (days == null || days <= 0) return "—"; // need holding period to annualize
  const r = (1 - curPrice) / curPrice;
  return formatRoiAsX(r * (365 / days));
}

export function PositionsList({ positions }: { positions: Position[] }) {
  const sorted = [...positions].sort((a, b) => {
    const daysA = daysToResolution(a.endDate, a.title);
    const daysB = daysToResolution(b.endDate, b.title);
    const paroiA = computePAROINumeric(a.curPrice, daysA);
    const paroiB = computePAROINumeric(b.curPrice, daysB);
    return paroiB - paroiA; // descending: highest PAROI first
  });

  return (
    <div className="space-y-2">
      {sorted.map((pos) => {
        const days = daysToResolution(pos.endDate, pos.title);
        const caroi = computeCAROI(pos.avgPrice, days);
        const paroi = computePAROI(pos.curPrice, days);
        // curPrice is the price of the outcome held; for Yes it's Yes prob, for No it's No prob
        const probabilityYes = pos.outcome.toLowerCase() === "yes" ? pos.curPrice : 1 - pos.curPrice;
        const probabilityNo = 1 - probabilityYes;
        const isYes = pos.outcome.toLowerCase() === "yes";
        // Yes position: Yes left, No right. No position: No left, Yes right.
        const leftPct = isYes ? probabilityYes : probabilityNo;
        const rightPct = isYes ? probabilityNo : probabilityYes;
        return (
          <div
            key={pos.asset}
            className="flex items-center gap-3 overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2"
          >
            <img
              src={pos.icon}
              alt=""
              className="h-9 w-9 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-medium text-white">{pos.title}</h3>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                    pos.outcome.toLowerCase() === "yes"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {pos.outcome}
                </span>
                {pos.endDate && (
                  <span className="text-xs text-slate-500">{pos.endDate}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400">
                  {formatCompactNum(pos.size)} @ {(pos.avgPrice * 100).toFixed(2)}¢ | {(pos.curPrice * 100).toFixed(2)}¢
                </span>
                <span className="text-slate-300">
                  {Math.abs(pos.currentValue) >= 1_000 ? formatCompactUsd(pos.currentValue, 0) : formatUsd(pos.currentValue, 2)}
                </span>
                <span
                  className={`font-medium ${
                    pos.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {pos.cashPnl >= 0 ? "+" : ""}
                  {Math.abs(pos.cashPnl) >= 1_000 ? formatCompactUsd(pos.cashPnl, 0) : formatUsd(pos.cashPnl, 2)}
                  {" "}({formatPercent(pos.percentPnl)})
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  CAROI {caroi}
                  <MetricTooltip content={METRIC_TOOLTIPS.CAROI} />
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  PAROI {paroi}
                  <MetricTooltip content={METRIC_TOOLTIPS.PAROI} />
                </span>
              </div>
            </div>
            <div className="shrink-0 flex min-w-[90px] w-24 flex-col gap-0.5">
              <div className="flex justify-between gap-2 text-[11px] font-medium">
                <span className={isYes ? "text-emerald-600/90" : "text-red-600/90"}>{isYes ? "Yes" : "No"} {(leftPct * 100).toFixed(0)}%</span>
                <span className={isYes ? "text-red-600/90" : "text-emerald-600/90"}>{isYes ? "No" : "Yes"} {(rightPct * 100).toFixed(0)}%</span>
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
      })}
    </div>
  );
}
