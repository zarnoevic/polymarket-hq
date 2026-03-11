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

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Days until resolution; null if endDate missing or in the past */
function daysToResolution(endDateStr: string): number | null {
  if (!endDateStr) return null;
  const d = new Date(endDateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  const days = ms / (24 * 60 * 60 * 1000);
  return days > 0 ? Math.max(1, Math.ceil(days)) : null;
}

/** Total Annualized ROI: (1/avgPrice)^(365/days) - 1 */
function computeTAROI(avgPrice: number, days: number | null): string {
  if (avgPrice <= 0) return "—";
  const raw = 1 / avgPrice - 1;
  if (days == null || days <= 0) return formatPct(raw);
  const ann = Math.pow(1 / avgPrice, 365 / days) - 1;
  return formatPct(ann);
}

/** Current Annualized ROI: (1/curPrice)^(365/days) - 1; returns numeric for sorting */
function computeCAROINumeric(curPrice: number, days: number | null): number {
  if (curPrice <= 0) return -Infinity;
  const raw = 1 / curPrice - 1;
  if (days == null || days <= 0) return raw;
  return Math.pow(1 / curPrice, 365 / days) - 1;
}

/** Current Annualized ROI: (1/curPrice)^(365/days) - 1 */
function computeCAROI(curPrice: number, days: number | null): string {
  if (curPrice <= 0) return "—";
  const raw = 1 / curPrice - 1;
  if (days == null || days <= 0) return formatPct(raw);
  const ann = Math.pow(1 / curPrice, 365 / days) - 1;
  return formatPct(ann);
}

export function PositionsList({ positions }: { positions: Position[] }) {
  const sorted = [...positions].sort((a, b) => {
    const daysA = daysToResolution(a.endDate);
    const daysB = daysToResolution(b.endDate);
    const caroiA = computeCAROINumeric(a.curPrice, daysA);
    const caroiB = computeCAROINumeric(b.curPrice, daysB);
    return caroiB - caroiA; // descending: highest CAROI first
  });

  return (
    <div className="space-y-2">
      {sorted.map((pos) => {
        const days = daysToResolution(pos.endDate);
        const taroi = computeTAROI(pos.avgPrice, days);
        const caroi = computeCAROI(pos.curPrice, days);
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
              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400">
                  {pos.size.toLocaleString(undefined, { maximumFractionDigits: 0 })} @ {(pos.avgPrice * 100).toFixed(2)}¢
                </span>
                <span className="text-slate-300">
                  {formatUsd(pos.currentValue, 2)}
                </span>
                <span
                  className={`font-medium ${
                    pos.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {pos.cashPnl >= 0 ? "+" : ""}
                  {formatUsd(pos.cashPnl, 2)} ({formatPercent(pos.percentPnl)})
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  TAROI {taroi}
                  <MetricTooltip content={METRIC_TOOLTIPS.TAROI} />
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  CAROI {caroi}
                  <MetricTooltip content={METRIC_TOOLTIPS.CAROI} />
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
