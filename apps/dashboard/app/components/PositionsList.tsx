"use client";

import { ExternalLink } from "lucide-react";
import { ParoiLabel, RoiLabel } from "./PositionMetricLabels";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { formatRoi, daysToResolution, computePAROINumeric } from "@/lib/position-metrics";

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
  /** Parent event slug (use for Polymarket link when market is child of event). */
  eventSlug?: string | null;
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

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** CROI (Cumulative ROI): simple (1 - buyPrice) / buyPrice, no annualization. */
function computeCROI(avgPrice: number, spread?: number | null): string {
  const buyPrice = Math.min(0.99, avgPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return "—";
  const r = (1 - buyPrice) / buyPrice;
  return Number.isFinite(r) ? formatRoi(r) : "—";
}

/** PROI (Present ROI): simple (1 - buyPrice) / buyPrice from current price, no annualization. */
function computePROI(curPrice: number, spread?: number | null): string {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return "—";
  const r = (1 - buyPrice) / buyPrice;
  return Number.isFinite(r) ? formatRoi(r) : "—";
}

/** PROI numeric for sorting. Uses buyPrice = curPrice + spread. */
function computePROINumeric(curPrice: number, spread?: number | null): number {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return -Infinity;
  const r = (1 - buyPrice) / buyPrice;
  return Number.isFinite(r) ? r : -Infinity;
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
  const croi = computeCROI(pos.avgPrice, pos.spread);
  const proi = computePROI(pos.curPrice, pos.spread);
  const paroiNum = computePAROINumeric(pos.curPrice, days, pos.spread);
  const paroi = Number.isFinite(paroiNum) ? formatRoi(paroiNum) : "—";
  const probabilityYes = pos.outcome.toLowerCase() === "yes" ? pos.curPrice : 1 - pos.curPrice;
  const probabilityNo = 1 - probabilityYes;
  const isYes = pos.outcome.toLowerCase() === "yes";
  const leftPct = isYes ? probabilityYes : probabilityNo;
  const rightPct = isYes ? probabilityNo : probabilityYes;
  const eventSlug = pos.eventSlug?.trim() || pos.slug?.trim();
  const marketUrl = eventSlug ? `https://polymarket.com/event/${eventSlug}` : null;

  const maxPayoutFormatted =
    pos.size > 0 && Number.isFinite(pos.size)
      ? Math.abs(pos.size) >= 1_000
        ? formatCompactUsd(pos.size, 0)
        : formatUsd(pos.size, 2)
      : null;

  const initialCapital =
    Math.abs(pos.initialValue) >= 1_000
      ? formatCompactUsd(pos.initialValue, 0)
      : formatUsd(pos.initialValue, 2);
  const currentCapital =
    Math.abs(pos.currentValue) >= 1_000
      ? formatCompactUsd(pos.currentValue, 0)
      : formatUsd(pos.currentValue, 2);
  const initialPriceStr = `${(pos.avgPrice * 100).toFixed(2)}¢`;
  const currentPriceStr = `${(pos.curPrice * 100).toFixed(2)}¢`;

  const cardContent = (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, pos.asset) : undefined}
      className={`flex items-center gap-3 overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <img src={pos.icon} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-0 text-sm">
          {marketUrl ? (
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full shrink-0 items-center gap-1.5 hover:opacity-90"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="min-w-0 truncate font-medium text-beige">{pos.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-indigo-400" />
            </a>
          ) : (
            <h3 className="min-w-0 truncate font-medium text-beige">{pos.title}</h3>
          )}
          <span className="mx-1.5 shrink-0 text-slate-600">·</span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
              pos.outcome.toLowerCase() === "yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            {pos.outcome}
          </span>
          {days != null && (
            <>
              <span className="mx-1.5 shrink-0 text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                {days} day{days !== 1 ? "s" : ""} left
              </span>
            </>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center text-xs">
          <span className="inline-flex flex-wrap items-baseline gap-0 text-slate-400">
            {initialPriceStr} → {currentPriceStr}
            <span className="mx-1.5 text-slate-600">·</span>
            {initialCapital} → {currentCapital}
            <span className="mx-1.5 text-slate-600">·</span>
            <span className={`font-medium ${pos.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {pos.cashPnl >= 0 ? "+" : ""}
              {Math.abs(pos.cashPnl) >= 1_000 ? formatCompactUsd(pos.cashPnl, 0) : formatUsd(pos.cashPnl, 2)} (
              {formatPercent(pos.percentPnl)})
            </span>
            <span className="mx-1.5 text-slate-600">·</span>
            {maxPayoutFormatted != null ? maxPayoutFormatted : "—"}
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="inline-flex items-center gap-1">
              <RoiLabel /> {croi} → {proi}
            </span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="inline-flex items-center gap-1">
              <ParoiLabel /> {paroi}
            </span>
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
        <div className="flex flex-wrap items-center justify-center gap-x-1 text-[11px] font-medium">
          <span className={isYes ? "text-emerald-600/90" : "text-red-600/90"}>
            {isYes ? "Yes" : "No"} {(leftPct * 100).toFixed(0)}%
          </span>
          <span className="text-slate-600">·</span>
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

  return cardContent;
}

export function PositionsList({ positions }: { positions: Position[] }) {
  const sorted = [...positions].sort((a, b) => {
    const proiA = computePROINumeric(a.curPrice, a.spread);
    const proiB = computePROINumeric(b.curPrice, b.spread);
    return proiB - proiA; // descending: highest PROI first
  });

  return (
    <div className="space-y-2">
      {sorted.map((pos) => (
        <PositionCard key={pos.asset} position={pos} />
      ))}
    </div>
  );
}
