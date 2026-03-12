"use client";

import { useState, useEffect } from "react";
import { loadPositionCategories, UNCategorized_ID } from "@/lib/position-categories";
import { formatRoi } from "@/lib/position-metrics";
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

function computeROINumeric(avgPrice: number, spread?: number | null): number | null {
  const buyPrice = Math.min(0.99, avgPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return null;
  const roi = (1 - buyPrice) / buyPrice;
  return Number.isFinite(roi) ? roi : null;
}

function computeCAROINumeric(avgPrice: number, days: number | null, spread?: number | null): number | null {
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

type CategorySlice = {
  title: string;
  pnl24h: number;
  absShare: number;
  color: string;
  icon?: string;
  investedAmount: number;
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
      const { positionToCategory, catNames } = loadCategoryData(wallet);

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

        const categoryId = positionToCategory[pos.asset] ?? UNCategorized_ID;
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
      const categorySlices: CategorySlice[] = Array.from(byCategory.entries())
        .map(([catId, { pnl, positions }]) => {
          const bestPos = positions.reduce((best, cur) => {
            const days = daysToResolution(cur.pos.endDate ?? "", cur.pos.title);
            const paroi = computePAROINumeric(cur.pos.curPrice, days, cur.pos.spread);
            const bestDays = daysToResolution(best.pos.endDate ?? "", best.pos.title);
            const bestParoi = computePAROINumeric(best.pos.curPrice, bestDays, best.pos.spread);
            return paroi > bestParoi ? cur : best;
          });
          let totalInvested = 0;
          let sumRoi = 0;
          let sumCaroi = 0;
          let sumProi = 0;
          let sumParoi = 0;
          let weightSum = 0;
          for (const { pos } of positions) {
            const inv =
              pos.avgPrice != null &&
              Number.isFinite(pos.avgPrice) &&
              pos.avgPrice > 0 &&
              pos.avgPrice < 1
                ? pos.size * pos.avgPrice
                : 0;
            if (inv <= 0) continue;
            const days = daysToResolution(pos.endDate ?? "", pos.title);
            const roi = computeROINumeric(pos.avgPrice!, pos.spread);
            const caroi = computeCAROINumeric(pos.avgPrice!, days, pos.spread);
            const proi = computeROINumeric(pos.curPrice, pos.spread); // simple present
            const paroi = computePAROINumeric(pos.curPrice, days, pos.spread);
            totalInvested += inv;
            if (roi != null) {
              sumRoi += roi * inv;
              weightSum += inv;
            }
            if (caroi != null) {
              sumCaroi += caroi * inv;
            }
            if (proi != null) sumProi += proi * inv;
            if (Number.isFinite(paroi) && paroi > -Infinity) {
              sumParoi += paroi * inv;
            }
          }
          const wRoi = weightSum > 0 ? sumRoi / weightSum : null;
          const wCaroi = totalInvested > 0 ? sumCaroi / totalInvested : null;
          const wProi = totalInvested > 0 ? sumProi / totalInvested : null;
          const wParoi = totalInvested > 0 ? sumParoi / totalInvested : null;
          const p = bestPos.pos;
          const sparkline =
            p.yesId || p.asset
              ? {
                  yesId: p.yesId ?? p.asset,
                  entryTimestamp: p.entryTimestamp,
                  outcome: p.outcome,
                  avgPrice: p.avgPrice ?? 0.5,
                }
              : undefined;
          return {
            title: catNames[catId] ?? catId,
            pnl24h: pnl,
            rawShare: totalAbs > 0 ? Math.abs(pnl) / totalAbs : 1 / byCategory.size,
            color: pnl >= 0 ? "#34D399" : "#F87171",
            icon: bestPos.pos.icon,
            investedAmount: totalInvested,
            roi: wRoi != null ? formatRoi(wRoi) : "—",
            caroi: wCaroi != null ? formatRoi(wCaroi) : "—",
            proi: wProi != null ? formatRoi(wProi) : "—",
            paroi: wParoi != null && wParoi > -Infinity ? formatRoi(wParoi) : "—",
            sparkline,
          };
        });
      const MIN_SHARE = 0.02;
      const totalAdjusted = categorySlices.reduce(
        (s, sl) => s + Math.max(sl.rawShare, MIN_SHARE),
        0
      );
      const slicesWithMin = categorySlices
        .map(({ rawShare, ...sl }) => ({
          ...sl,
          absShare: totalAdjusted > 0 ? Math.max(rawShare, MIN_SHARE) / totalAdjusted : 1 / categorySlices.length,
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
              let sumRoi = 0;
              let sumCaroi = 0;
              let sumProi = 0;
              let sumParoi = 0;
              let weightSum = 0;
              for (const { pos } of positions) {
                const inv =
                  pos.avgPrice != null &&
                  Number.isFinite(pos.avgPrice) &&
                  pos.avgPrice > 0 &&
                  pos.avgPrice < 1
                    ? pos.size * pos.avgPrice
                    : 0;
                if (inv <= 0) continue;
                const days = daysToResolution(pos.endDate ?? "", pos.title);
                const roi = computeROINumeric(pos.avgPrice!, pos.spread);
                const caroi = computeCAROINumeric(pos.avgPrice!, days, pos.spread);
                const proi = computeROINumeric(pos.curPrice, pos.spread);
                const paroi = computePAROINumeric(pos.curPrice, days, pos.spread);
                totalInvested += inv;
                if (roi != null) {
                  sumRoi += roi * inv;
                  weightSum += inv;
                }
                if (caroi != null) sumCaroi += caroi * inv;
                if (proi != null) sumProi += proi * inv;
                if (Number.isFinite(paroi) && paroi > -Infinity) sumParoi += paroi * inv;
              }
              const wRoi = weightSum > 0 ? sumRoi / weightSum : null;
              const wCaroi = totalInvested > 0 ? sumCaroi / totalInvested : null;
              const wProi = totalInvested > 0 ? sumProi / totalInvested : null;
              const wParoi = totalInvested > 0 ? sumParoi / totalInvested : null;
              const p = bestPos.pos;
              const sparkline =
                p.yesId || p.asset
                  ? { yesId: p.yesId ?? p.asset, entryTimestamp: p.entryTimestamp, outcome: p.outcome, avgPrice: p.avgPrice ?? 0.5 }
                  : undefined;
              return {
                title: catNames[catId] ?? catId,
                pnl24h: pnl,
                absShare: 0,
                color: "#64748b",
                icon: bestPos.pos.icon,
                investedAmount: totalInvested,
                roi: wRoi != null ? formatRoi(wRoi) : "—",
                caroi: wCaroi != null ? formatRoi(wCaroi) : "—",
                proi: wProi != null ? formatRoi(wProi) : "—",
                paroi: wParoi != null && wParoi > -Infinity ? formatRoi(wParoi) : "—",
                sparkline,
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
    "h-[460px] w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

  if (loading) {
    return (
      <div className={cardClass}>
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          24h attribution by category
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
      <div className={cardClass}>
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
  const size = 260;
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

  return (
    <div className="flex h-[460px] w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
      <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
        24h attribution by category
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
        <div className="min-h-[5rem] w-full min-w-0 shrink-0 overflow-y-auto">
          {activeSlice ? (
            <div className="rounded-lg bg-slate-800/50 px-4 py-3 transition-colors">
              <p className="text-sm font-medium text-slate-200 leading-snug text-center">
                {activeSlice.title}
              </p>
              <div className="mt-2 shrink-0 rounded-lg border border-slate-600/60 bg-slate-700/40 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                  Contributed to 24h P&L
                </p>
                <p
                  className={`text-xl font-bold ${
                    (activeSlice.pnl24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatUsd(activeSlice.pnl24h ?? 0)}
                  {Math.abs(totalPnl) > 0.01 && (
                    <span className="ml-1.5 text-sm font-normal text-slate-400">
                      ({(((activeSlice.pnl24h ?? 0) / totalPnl) * 100).toFixed(0)}% of total)
                    </span>
                  )}
                </p>
              </div>
              {activeSlice.sparkline && (
                <div className="mt-2 flex items-center justify-center w-full h-10">
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
                    {formatPositionValue(activeSlice.investedAmount)} invested
                  </span>
                )}
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
            <div className="flex flex-col py-3">
              <div className="text-center">
                <p className="text-xs text-slate-500">Total 24h P&L</p>
                <p
                  className={`mt-0.5 text-xl font-bold ${
                    totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatUsd(totalPnl)}
                </p>
              </div>
              <div className="mt-3 space-y-1 overflow-y-auto max-h-24">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 px-1">
                  Contribution per category
                </p>
                {slices.map((sl, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded px-2 py-0.5 text-xs hover:bg-slate-700/40 cursor-pointer"
                    onClick={() => setSelected(i)}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className="truncate text-slate-300" title={sl.title}>
                      {sl.title}
                    </span>
                    <span
                      className={`shrink-0 font-mono ${
                        sl.pnl24h >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatUsd(sl.pnl24h)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">
                Click a slice or row to see details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
