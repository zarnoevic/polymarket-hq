"use client";

import { useState, useEffect } from "react";
import { fetchPositionCategories, UNCategorized_ID } from "@/lib/position-categories";

const CLOB_BASE = "https://clob.polymarket.com";

type Position = {
  asset: string;
  title: string;
  size: number;
  curPrice: number;
  avgPrice?: number;
  currentValue?: number;
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

function parseDateFromTitle(title: string): Date | null {
  const m = title.match(/(?:by\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})/i);
  if (!m) return null;
  const year = new Date().getFullYear();
  const d = new Date(`${m[1]} ${m[2]}, ${year}`);
  if (isNaN(d.getTime())) return null;
  if (d < new Date()) d.setFullYear(year + 1);
  return d;
}

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

function computePAROINumeric(curPrice: number, days: number | null, spread?: number | null): number {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0) return -Infinity;
  if (days == null || days <= 0) return -Infinity;
  const r = (1 - buyPrice) / buyPrice;
  return r * (365 / days);
}

function formatPositionValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}k`;
  return `$${abs.toFixed(2)}`;
}

/** Darken hex for stroke to match slice fill */
function darkenHex(hex: string, factor = 0.55): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * factor);
  const g = Math.round(parseInt(m[2], 16) * factor);
  const b = Math.round(parseInt(m[3], 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

type CategorySlice = {
  title: string;
  pnl24h: number;
  absShare: number;
  color: string;
  icon?: string;
  investedAmount: number;
};

type CategorySliceRaw = Omit<CategorySlice, "absShare"> & { rawShare: number };

async function loadCategoryData(wallet?: string): Promise<{
  positionToCategory: Record<string, string>;
  catNames: Record<string, string>;
}> {
  const { categories, positionToCategory } = await fetchPositionCategories(wallet);
  const catNames: Record<string, string> = { [UNCategorized_ID]: "Uncategorized" };
  for (const c of categories) catNames[c.id] = c.name;
  return { positionToCategory, catNames };
}

export function CategoryAttributionPieChart({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet?: string;
}) {
  const [slices, setSlices] = useState<CategorySlice[]>([]);
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
      let positionToCategory: Record<string, string> = {};
      let catNames: Record<string, string> = { [UNCategorized_ID]: "Uncategorized" };
      try {
        const data = await loadCategoryData(wallet);
        positionToCategory = data.positionToCategory;
        catNames = data.catNames;
      } catch {
        if (cancelled) return;
        // On API failure: fall back to all Uncategorized so chart still renders
      }

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

        let priceThen: number | null;
        if (entryRecently && entryPrice != null) {
          priceThen = entryPrice;
        } else {
          const price24h = await fetchPrice24hAgo(tokenId);
          priceThen = price24h != null ? (isYes ? price24h : 1 - price24h) : null;
        }

        const priceNow =
          pos.currentValue != null &&
          Number.isFinite(pos.currentValue) &&
          pos.size > 0
            ? pos.currentValue / pos.size
            : pos.curPrice;

        let pnl24h = 0;
        if (priceThen != null) {
          pnl24h = pos.size * (priceNow - priceThen);
        }

        const categoryId =
          positionToCategory[pos.asset] ??
          positionToCategory[pos.yesId ?? ""] ??
          UNCategorized_ID;
        return { categoryId, pnl24h, pos };
      });

      const results = await Promise.all(promises);
      if (cancelled) return;

      const byCategory = new Map<string, { pnl: number; positions: { pos: Position; pnl24h: number }[] }>();
      for (const r of results) {
        const cur = byCategory.get(r.categoryId);
        if (!cur) {
          byCategory.set(r.categoryId, { pnl: r.pnl24h, positions: [{ pos: r.pos, pnl24h: r.pnl24h }] });
        } else {
          cur.pnl += r.pnl24h;
          cur.positions.push({ pos: r.pos, pnl24h: r.pnl24h });
        }
      }

      const fullTotal = results.reduce((s, r) => s + r.pnl24h, 0);
      setTotalPnl24h(fullTotal);

      const totalAbs = Array.from(byCategory.values()).reduce((s, v) => s + Math.abs(v.pnl), 0);
      const categorySlicesRaw = Array.from(byCategory.entries())
        .map(([catId, { pnl, positions }]) => {
          const bestPos = positions.reduce((best, cur) => {
            const days = daysToResolution(cur.pos.endDate ?? "", cur.pos.title);
            const paroi = computePAROINumeric(cur.pos.curPrice, days, cur.pos.spread);
            const bestDays = daysToResolution(best.pos.endDate ?? "", best.pos.title);
            const bestParoi = computePAROINumeric(best.pos.curPrice, bestDays, best.pos.spread);
            return paroi > bestParoi ? cur : best;
          });
          let totalInvested = 0;
          for (const { pos } of positions) {
            const inv =
              pos.avgPrice != null &&
              Number.isFinite(pos.avgPrice) &&
              pos.avgPrice > 0 &&
              pos.avgPrice < 1
                ? pos.size * pos.avgPrice
                : 0;
            if (inv > 0) totalInvested += inv;
          }
          return {
            title: catNames[catId] ?? catId,
            pnl24h: pnl,
            rawShare: totalAbs > 0 ? Math.abs(pnl) / totalAbs : 1 / byCategory.size,
            color: pnl >= 0 ? "#34D399" : "#F87171",
            icon: bestPos.pos.icon,
            investedAmount: totalInvested,
          };
        });
      const MIN_SHARE = 0.02;
      const totalAdjusted = categorySlicesRaw.reduce(
        (s, sl) => s + Math.max(sl.rawShare, MIN_SHARE),
        0
      );
      const slicesWithMin = categorySlicesRaw
        .map(({ rawShare, ...sl }) => ({
          ...sl,
          absShare: totalAdjusted > 0 ? Math.max(rawShare, MIN_SHARE) / totalAdjusted : 1 / categorySlicesRaw.length,
        }))
        .sort((a, b) => (b.pnl24h >= 0 ? 1 : -1) - (a.pnl24h >= 0 ? 1 : -1));

      setSlices(
        slicesWithMin.length > 0
          ? slicesWithMin
          : Array.from(byCategory.entries()).map(([catId, { pnl, positions }]) => {
              const bestPos = positions.reduce((best, cur) => {
                const days = daysToResolution(cur.pos.endDate ?? "", cur.pos.title);
                const paroi = computePAROINumeric(cur.pos.curPrice, days, cur.pos.spread);
                const bestDays = daysToResolution(best.pos.endDate ?? "", best.pos.title);
                const bestParoi = computePAROINumeric(best.pos.curPrice, bestDays, best.pos.spread);
                return paroi > bestParoi ? cur : best;
              });
              let totalInvested = 0;
              for (const { pos } of positions) {
                const inv =
                  pos.avgPrice != null &&
                  Number.isFinite(pos.avgPrice) &&
                  pos.avgPrice > 0 &&
                  pos.avgPrice < 1
                    ? pos.size * pos.avgPrice
                    : 0;
                if (inv > 0) totalInvested += inv;
              }
              return {
                title: catNames[catId] ?? catId,
                pnl24h: pnl,
                absShare: 0,
                color: "#64748b",
                icon: bestPos.pos.icon,
                investedAmount: totalInvested,
              };
            })
      );
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [positions, wallet]);

  const cardClass =
    "h-[480px] w-[340px] shrink-0 overflow-hidden rounded-2xl bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

  if (loading) {
    return (
      <div className={cardClass} style={{ border: "3px solid #000" }}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          24h attribution by category
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
          24h attribution by category
        </h3>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No categories or positions
        </div>
      </div>
    );
  }

  const totalAbs = slices.reduce((s, sl) => s + sl.absShare, 0);
  if (totalAbs === 0) {
    return (
      <div className={cardClass} style={{ border: "3px solid #000" }}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          24h attribution by category
        </h3>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-slate-400">No 24h price data</p>
          <p className="text-xs text-slate-500">
            Total P&L: {formatUsd(totalPnl24h)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <CategoryPieChartInner slices={slices} totalPnl={totalPnl24h} />
  );
}

function CategoryPieChartInner({
  slices,
  totalPnl,
}: {
  slices: CategorySlice[];
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

  // Match working AttributionPieChart: use absShare directly. Avoid degenerate arc when pct=1 (SVG arc A→A renders as line)
  let acc = 0;
  const paths = slices.map((sl, i) => {
    let pct = sl.absShare;
    if (pct >= 0.9999) pct = 0.9999; // full circle arc is degenerate (same start/end)
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
        24h attribution by category
      </h3>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
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
                  filter: active === i ? "drop-shadow(0 0 8px rgba(230,230,225,0.3))" : undefined,
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
              <p className="text-sm font-medium text-beige leading-snug">
                {activeSlice.title}
              </p>
              <div className="mt-2 flex flex-col items-center gap-1 text-sm">
                <p
                  className={`text-base font-semibold ${
                    activeSlice.pnl24h >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatUsd(activeSlice.pnl24h)}
                </p>
                <span className="font-mono text-slate-300">
                  {formatPositionValue(activeSlice.investedAmount)} invested
                </span>
              </div>
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
