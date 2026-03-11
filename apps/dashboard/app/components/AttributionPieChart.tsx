"use client";

import { useState, useEffect, useMemo } from "react";

const CLOB_BASE = "https://clob.polymarket.com";

type Position = {
  asset: string;
  title: string;
  size: number;
  curPrice: number;
  outcome: string;
  yesId?: string;
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

type Slice = {
  title: string;
  pnl24h: number;
  absShare: number;
  color: string;
};

export function AttributionPieChart({ positions }: { positions: Position[] }) {
  const [slices, setSlices] = useState<Slice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (positions.length === 0) {
      setSlices([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      const promises = positions.map(async (pos) => {
        const tokenId = pos.yesId ?? pos.asset;
        const isYes = pos.outcome.toLowerCase() === "yes";
        const price24h = await fetchPrice24hAgo(tokenId);
        let pnl24h = 0;
        if (price24h != null) {
          // curPrice is always the price of the outcome held (Yes or No)
          // price24h from API is Yes token price; for No we need 1 - price24h
          const priceNow = pos.curPrice;
          const priceThen = isYes ? price24h : 1 - price24h;
          pnl24h = pos.size * (priceNow - priceThen);
        }
        return {
          title: pos.title.length > 25 ? pos.title.slice(0, 22) + "…" : pos.title,
          pnl24h,
        };
      });
      const results = await Promise.all(promises);
      if (cancelled) return;
      const totalAbs = results.reduce((s, r) => s + Math.abs(r.pnl24h), 0);
      const withShares = results
        .map((r) => ({
          ...r,
          absShare: totalAbs > 0 ? Math.abs(r.pnl24h) / totalAbs : 0,
          color: r.pnl24h >= 0 ? "#34D399" : "#F87171",
        }))
        .filter((r) => r.absShare > 0.001);
      setSlices(withShares.length > 0 ? withShares : results.map((r) => ({ ...r, absShare: 0, color: "#64748b" })));
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [positions]);

  const totalPnl = useMemo(
    () => slices.reduce((s, sl) => s + sl.pnl24h, 0),
    [slices]
  );

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Attribution (24h)
        </h3>
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        </div>
      </div>
    );
  }

  if (slices.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Attribution (24h)
        </h3>
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          No positions
        </div>
      </div>
    );
  }

  const totalAbs = slices.reduce((s, sl) => s + sl.absShare, 0);
  if (totalAbs === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Attribution (24h)
        </h3>
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-slate-400">No 24h price data</p>
          <p className="text-xs text-slate-500">
            Total P&L: {formatUsd(slices.reduce((s, sl) => s + sl.pnl24h, 0))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PieChartInner slices={slices} totalPnl={totalPnl} />
  );
}

function PieChartInner({
  slices,
  totalPnl,
}: {
  slices: Slice[];
  totalPnl: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let acc = 0;
  const paths = slices.map((sl, i) => {
    const pct = sl.absShare;
    const startAngle = acc * 2 * Math.PI - Math.PI / 2;
    acc += pct;
    const endAngle = acc * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, ...sl, i };
  });

  const hoveredSlice = hovered != null ? paths[hovered] : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Attribution (24h)
      </h3>
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <svg width={size} height={size} className="overflow-visible">
            {paths.map(({ d, color, i }) => (
              <path
                key={i}
                d={d}
                fill={color}
                className="cursor-pointer transition-opacity"
                opacity={hovered != null && hovered !== i ? 0.4 : 1}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                stroke={hovered === i ? "rgba(255,255,255,0.5)" : "transparent"}
                strokeWidth={2}
              />
            ))}
          </svg>
        </div>
        {hoveredSlice ? (
          <div className="min-h-[3rem] text-center">
            <p className="truncate max-w-[180px] text-xs font-medium text-white">
              {hoveredSlice.title}
            </p>
            <p
              className={`text-sm font-semibold ${
                hoveredSlice.pnl24h >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatUsd(hoveredSlice.pnl24h)}
            </p>
          </div>
        ) : (
          <div className="min-h-[3rem] text-center">
            <p className="text-xs text-slate-500">Total 24h P&L</p>
            <p
              className={`text-sm font-semibold ${
                totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatUsd(totalPnl)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
