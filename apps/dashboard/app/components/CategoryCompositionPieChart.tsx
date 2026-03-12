"use client";

import { useState, useEffect } from "react";
import { loadPositionCategories, UNCategorized_ID } from "@/lib/position-categories";
import {
  daysToResolution,
  formatRoi,
  computeROINumeric,
  computePAROINumeric,
} from "@/lib/position-metrics";
import { MetricTooltip } from "./MetricTooltip";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { METRIC_TOOLTIPS } from "@/lib/metric-tooltips";

type Position = {
  asset: string;
  title: string;
  size: number;
  curPrice: number;
  avgPrice?: number;
  /** From Polymarket API - canonical amount invested (matches positions list). */
  initialValue?: number;
  currentValue?: number;
  entryTimestamp?: number;
  outcome: string;
  yesId?: string;
  icon?: string;
  endDate?: string;
  spread?: number | null;
};

/** Position value for allocation: use API currentValue when available (matches Positions card), else size×curPrice. */
function getPositionValue(pos: Position): number {
  if (
    pos.currentValue != null &&
    Number.isFinite(pos.currentValue) &&
    pos.currentValue >= 0
  ) {
    return pos.currentValue;
  }
  return pos.size * (pos.curPrice ?? 0);
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

function formatPositionValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}k`;
  return `$${abs.toFixed(2)}`;
}

const CATEGORY_COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#64748b", // slate
];

type CompositionSlice = {
  title: string;
  investedAmount: number;
  share: number;
  positionCount: number;
  color: string;
  icon?: string;
  roi: string;
  caroi: string;
  proi: string;
  paroi: string;
  sparkline?: { yesId: string; entryTimestamp?: number; outcome: string; avgPrice: number };
};

function loadCategoryData(wallet?: string): {
  positionToCategory: Record<string, string>;
  catNames: Record<string, string>;
} {
  const { categories, positionToCategory } = loadPositionCategories(wallet);
  const catNames: Record<string, string> = { [UNCategorized_ID]: "Uncategorized" };
  for (const c of categories) catNames[c.id] = c.name;
  return { positionToCategory, catNames };
}

export function CategoryCompositionPieChart({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet?: string;
}) {
  const [slices, setSlices] = useState<CompositionSlice[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (positions.length === 0) {
      setSlices([]);
      setTotalInvested(0);
      setLoading(false);
      return;
    }
    const { positionToCategory, catNames } = loadCategoryData(wallet);

    const byCategory = new Map<
      string,
      {
        invested: number;
        positions: Position[];
      }
    >();

    for (const pos of positions) {
      const categoryId = positionToCategory[pos.asset] ?? UNCategorized_ID;
      const invested = getPositionValue(pos);

      const cur = byCategory.get(categoryId);
      if (!cur) {
        byCategory.set(categoryId, { invested, positions: [pos] });
      } else {
        cur.invested += invested;
        cur.positions.push(pos);
      }
    }

    const computedTotal = Array.from(byCategory.values()).reduce(
      (s, c) => s + c.invested,
      0
    );

    const slicesArray: CompositionSlice[] = Array.from(byCategory.entries())
      .map(([catId, { invested, positions: catPositions }], idx) => {
        const share = computedTotal > 0 ? invested / computedTotal : 0;
        const bestPos = catPositions.reduce((best, cur) => {
          const days = daysToResolution(cur.endDate ?? "", cur.title);
          const paroi = computePAROINumeric(cur.curPrice, days, cur.spread);
          const bestDays = daysToResolution(best.endDate ?? "", best.title);
          const bestParoi = computePAROINumeric(best.curPrice, bestDays, best.spread);
          return paroi > bestParoi ? cur : best;
        });

        let totalInvestedCat = 0;
        let sumRoi = 0;
        let sumCaroi = 0;
        let sumProi = 0;
        let sumParoi = 0;
        let weightSum = 0;
        for (const pos of catPositions) {
          const inv = getPositionValue(pos);
          totalInvestedCat += inv;
          if (inv <= 0) continue;
          const days = daysToResolution(pos.endDate ?? "", pos.title);
          const roi =
            pos.avgPrice != null &&
            Number.isFinite(pos.avgPrice) &&
            pos.avgPrice > 0 &&
            pos.avgPrice < 1
              ? computeROINumeric(pos.avgPrice, pos.spread)
              : null;
          const caroi =
            pos.avgPrice != null &&
            Number.isFinite(pos.avgPrice) &&
            pos.avgPrice > 0 &&
            pos.avgPrice < 1
              ? computeCAROINumeric(pos.avgPrice, days, pos.spread)
              : null;
          const proi = computeROINumeric(pos.curPrice, pos.spread);
          const paroi = computePAROINumeric(pos.curPrice, days, pos.spread);
          if (roi != null) {
            sumRoi += roi * inv;
            weightSum += inv;
          }
          if (caroi != null) sumCaroi += caroi * inv;
          if (proi != null) sumProi += proi * inv;
          if (Number.isFinite(paroi) && paroi > -Infinity) sumParoi += paroi * inv;
        }
        const wRoi = weightSum > 0 ? sumRoi / weightSum : null;
        const wCaroi = totalInvestedCat > 0 ? sumCaroi / totalInvestedCat : null;
        const wProi = totalInvestedCat > 0 ? sumProi / totalInvestedCat : null;
        const wParoi = totalInvestedCat > 0 ? sumParoi / totalInvestedCat : null;

        const sparkline =
          bestPos.yesId || bestPos.asset
            ? {
                yesId: bestPos.yesId ?? bestPos.asset,
                entryTimestamp: bestPos.entryTimestamp,
                outcome: bestPos.outcome,
                avgPrice: bestPos.avgPrice ?? 0.5,
              }
            : undefined;

        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

        return {
          title: catNames[catId] ?? catId,
          investedAmount: totalInvestedCat,
          share,
          positionCount: catPositions.length,
          color,
          icon: bestPos.icon,
          roi: wRoi != null ? formatRoi(wRoi) : "—",
          caroi: wCaroi != null ? formatRoi(wCaroi) : "—",
          proi: wProi != null ? formatRoi(wProi) : "—",
          paroi:
            wParoi != null && wParoi > -Infinity ? formatRoi(wParoi) : "—",
          sparkline,
        };
      });

    const MIN_SHARE = 0.001;
    const aboveThreshold = slicesArray.filter((s) => s.share > MIN_SHARE);
    const belowThreshold = slicesArray.filter((s) => s.share <= MIN_SHARE);
    const otherInvested = belowThreshold.reduce((s, sl) => s + sl.investedAmount, 0);
    const otherShare = computedTotal > 0 ? otherInvested / computedTotal : 0;

    const slicesFinal =
      otherInvested > 0 && belowThreshold.length > 0
        ? [
            ...aboveThreshold.sort((a, b) => b.share - a.share),
            {
              title: "Other",
              investedAmount: otherInvested,
              share: otherShare,
              positionCount: belowThreshold.reduce((s, sl) => s + sl.positionCount, 0),
              color: "#475569",
              roi: "—",
              caroi: "—",
              paroi: "—",
            } as CompositionSlice,
          ]
        : aboveThreshold.sort((a, b) => b.share - a.share);

    setSlices(slicesFinal);
    setTotalInvested(computedTotal);
    setLoading(false);
  }, [positions, wallet]);

  const cardClass =
    "h-[460px] w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

  if (loading) {
    return (
      <div className={cardClass}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          By category (allocation)
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
          By category (allocation)
        </h3>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No categories or positions
        </div>
      </div>
    );
  }

  return (
    <CompositionPieChartInner slices={slices} totalInvested={totalInvested} />
  );
}

function CompositionPieChartInner({
  slices,
  totalInvested,
}: {
  slices: CompositionSlice[];
  totalInvested: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = selected ?? hovered;
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter * 0.55;

  let acc = 0;
  const paths = slices.map((sl, i) => {
    const pct = sl.share;
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

  return (
    <div className="flex h-[460px] w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
      <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
        By category (allocation)
      </h3>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden">
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
                onClick={() => setSelected((prev) => (prev === i ? null : i))}
                style={{
                  filter:
                    active === i
                      ? "drop-shadow(0 0 8px rgba(255,255,255,0.3))"
                      : undefined,
                }}
              />
            ))}
          </svg>
          {activeSlice?.icon && (
            <div
              className="absolute left-1/2 top-1/2 flex h-[100px] w-[100px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700/60 bg-slate-800/80 shadow-lg transition-opacity duration-200"
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
        <div className="min-h-[5rem] w-full min-w-0 shrink-0 overflow-y-auto">
          {activeSlice ? (
            <div className="rounded-lg bg-slate-800/50 px-4 py-3 transition-colors">
              <p className="text-center text-sm font-medium text-slate-200 leading-snug">
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
                {activeSlice.investedAmount > 0 && (
                  <span className="font-mono text-slate-300">
                    {formatPositionValue(activeSlice.investedAmount)} value
                  </span>
                )}
                <span className="font-mono text-slate-400">
                  {activeSlice.positionCount}{" "}
                  {activeSlice.positionCount === 1 ? "position" : "positions"}
                </span>
                <span className="font-mono text-slate-400">
                  {(activeSlice.share * 100).toFixed(1)}%
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.CROI} trigger="CROI" /> {activeSlice.roi}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.CAROI} trigger="CAROI" /> {activeSlice.caroi}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.PROI} trigger="PROI" /> {activeSlice.proi}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MetricTooltip content={METRIC_TOOLTIPS.PAROI} trigger="PAROI" /> {activeSlice.paroi}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 text-center">
              <p className="text-xs text-slate-500">Positions value</p>
              <p className="mt-0.5 text-xl font-bold text-white">
                {formatPositionValue(totalInvested)}
              </p>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Slices sized by position allocation. Click or hover to see
                details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
