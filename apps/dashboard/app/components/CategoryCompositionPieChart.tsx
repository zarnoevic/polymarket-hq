"use client";

import { useState, useEffect } from "react";
import { loadPositionCategories, UNCategorized_ID } from "@/lib/position-categories";
import { daysToResolution, computePAROINumeric } from "@/lib/position-metrics";

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

function formatPositionValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}k`;
  return `$${abs.toFixed(2)}`;
}

/** Darken hex color for matching stroke (factor 0.5 = 50% darker) */
function darkenHex(hex: string, factor = 0.55): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * factor);
  const g = Math.round(parseInt(m[2], 16) * factor);
  const b = Math.round(parseInt(m[3], 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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

        const totalInvestedCat = catPositions.reduce((s, pos) => s + getPositionValue(pos), 0);
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

        return {
          title: catNames[catId] ?? catId,
          investedAmount: totalInvestedCat,
          share,
          positionCount: catPositions.length,
          color,
          icon: bestPos.icon,
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
            },
          ]
        : aboveThreshold.sort((a, b) => b.share - a.share);

    setSlices(slicesFinal);
    setTotalInvested(computedTotal);
    setLoading(false);
  }, [positions, wallet]);

  const cardClass =
    "h-[480px] w-[340px] shrink-0 overflow-hidden rounded-2xl bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

  if (loading) {
    return (
      <div className={cardClass} style={{ border: "3px solid #000" }}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          By category (allocation)
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-black border-t-indigo-400" />
        </div>
      </div>
    );
  }

  if (slices.length === 0) {
    return (
      <div className={cardClass} style={{ border: "3px solid #000" }}>
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
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter * 0.55;

  let acc = 0;
  const paths = slices.map((sl, i) => {
    const pct = Math.max(0, Number(sl.share) || 0);
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
    <div className="flex h-[480px] w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm" style={{ border: "3px solid #000" }}>
      <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
        By category (allocation)
      </h3>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden">
        <div className="relative shrink-0">
          <svg width={size} height={size} className="overflow-visible">
            {paths.map(({ d, color, i }) => (
              <path
                key={i}
                d={d}
                fill={color}
                stroke={darkenHex(color)}
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
        <div className="min-h-[7rem] w-full min-w-0 shrink-0">
          {activeSlice ? (
            <div className="rounded-lg bg-slate-800/50 px-4 py-3 text-center transition-colors">
              {selected != null && (
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Click again to deselect</p>
              )}
              <p className="text-sm font-medium text-slate-200 leading-snug">
                {activeSlice.title}
              </p>
              <div className="mt-2 flex flex-col items-center gap-1 text-sm">
                <span className="font-mono text-white font-semibold">
                  {(activeSlice.share * 100).toFixed(1)}%
                </span>
                <span className="font-mono text-slate-300">
                  {formatPositionValue(activeSlice.investedAmount)} invested
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-xs text-slate-500">Positions value</p>
              <p className="mt-0.5 text-xl font-bold text-white">
                {formatPositionValue(totalInvested)}
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
