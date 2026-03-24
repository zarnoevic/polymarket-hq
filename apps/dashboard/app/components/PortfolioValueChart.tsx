"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

export type PortfolioChartPoint = {
  capturedAt: string;
  totalValue: number;
  cash: number;
  positionsValue: number;
};

function formatUsd(value: number, maxDecimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

function formatHoverTime(tMs: number, spanMs: number): string {
  const d = new Date(tMs);
  if (spanMs <= 86_400_000 * 2) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  if (spanMs <= 86_400_000 * 14) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function interpolateAtTime(
  t: number,
  tms: number[],
  pts: PortfolioChartPoint[]
): { totalValue: number; cash: number; positionsValue: number } {
  if (pts.length === 0) {
    return { totalValue: 0, cash: 0, positionsValue: 0 };
  }
  if (pts.length === 1 || t <= tms[0]!) {
    const p = pts[0]!;
    return {
      totalValue: p.totalValue,
      cash: p.cash,
      positionsValue: p.positionsValue,
    };
  }
  const last = tms.length - 1;
  if (t >= tms[last]!) {
    const p = pts[last]!;
    return {
      totalValue: p.totalValue,
      cash: p.cash,
      positionsValue: p.positionsValue,
    };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tms[mid]! <= t) lo = mid;
    else hi = mid;
  }
  const t0 = tms[lo]!;
  const t1 = tms[hi]!;
  const u = (t - t0) / (t1 - t0);
  const lerp = (a: number, b: number) => a + u * (b - a);
  return {
    totalValue: lerp(pts[lo]!.totalValue, pts[hi]!.totalValue),
    cash: lerp(pts[lo]!.cash, pts[hi]!.cash),
    positionsValue: lerp(pts[lo]!.positionsValue, pts[hi]!.positionsValue),
  };
}

const pad = 24;
const w = 400;
const h = 160;

export function PortfolioValueChart({
  history,
  className,
}: {
  history: PortfolioChartPoint[];
  className?: string;
}) {
  const [hover, setHover] = useState<{
    clientX: number;
    clientY: number;
    svgX: number;
    svgY: number;
    timeMs: number;
    totalValue: number;
    cash: number;
    positionsValue: number;
    spanMs: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      ),
    [history]
  );

  const timesMs = useMemo(
    () => points.map((p) => new Date(p.capturedAt).getTime()),
    [points]
  );

  const tMin = timesMs[0] ?? 0;
  const tMax = timesMs[timesMs.length - 1] ?? tMin;
  const spanMs = Math.max(1, tMax - tMin);

  const values = points.map((p) => p.totalValue);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 0.01;

  const xScaleTime = useCallback(
    (tMs: number) => {
      const u = (tMs - tMin) / spanMs;
      return pad + u * (w - 2 * pad);
    },
    [tMin, spanMs]
  );

  const yScale = useCallback(
    (v: number) => h - pad - ((v - minV) / range) * (h - 2 * pad),
    [minV, range]
  );

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    return points
      .map((p, i) => {
        const tx = xScaleTime(timesMs[i]!);
        const ty = yScale(p.totalValue);
        return `${i === 0 ? "M" : "L"} ${tx} ${ty}`;
      })
      .join(" ");
  }, [points, timesMs, xScaleTime, yScale]);

  const areaD =
    pathD +
    (points.length >= 2
      ? ` L ${xScaleTime(timesMs[timesMs.length - 1]!)} ${h - pad} L ${xScaleTime(timesMs[0]!)} ${h - pad} Z`
      : "");

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length < 2 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const xClient = e.clientX - rect.left;
      const svgXRaw = (xClient / rect.width) * w;
      const u = Math.max(0, Math.min(1, (svgXRaw - pad) / (w - 2 * pad)));
      const timeMs = tMin + u * spanMs;
      const interp = interpolateAtTime(timeMs, timesMs, points);
      const svgX = xScaleTime(timeMs);
      const svgY = yScale(interp.totalValue);
      setHover({
        clientX: e.clientX,
        clientY: e.clientY,
        svgX,
        svgY,
        timeMs,
        totalValue: interp.totalValue,
        cash: interp.cash,
        positionsValue: interp.positionsValue,
        spanMs,
      });
    },
    [points, timesMs, tMin, spanMs, xScaleTime, yScale]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  if (points.length < 2) {
    return (
      <div
        className={`rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 ${className ?? ""}`}
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Portfolio value
        </p>
        <p className="text-center text-sm text-slate-500">
          History builds as you refresh this page. Two or more snapshots unlock the chart.
        </p>
      </div>
    );
  }

  const decimals =
    spanMs <= 86_400_000 * 2 ? 2 : spanMs <= 86_400_000 * 14 ? 1 : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 ${className ?? ""}`}
    >
      <div className="px-4 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Portfolio value over time
        </p>
      </div>
      {/* Wrapper keeps hover dot in screen pixels (true circle); SVG uses preserveAspectRatio="none" which ovals circles */}
      <div className="relative h-40 w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="block h-full w-full"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="portfolioValueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#portfolioValueArea)" />
          <path
            d={pathD}
            fill="none"
            stroke="rgb(139 92 246)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {hover && (
            <line
              x1={hover.svgX}
              y1={pad}
              x2={hover.svgX}
              y2={h - pad}
              stroke="rgb(148 163 184)"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-amber-400 shadow-sm"
            style={{
              left: `${(hover.svgX / w) * 100}%`,
              top: `${(hover.svgY / h) * 100}%`,
            }}
            aria-hidden
          />
        )}
      </div>
      {hover &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 max-w-sm rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-xl"
            style={{
              left: hover.clientX,
              top: hover.clientY,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <div className="text-slate-400">
              {formatHoverTime(hover.timeMs, hover.spanMs)}
            </div>
            <div className="mt-1 font-semibold text-beige">
              Total {formatUsd(hover.totalValue, decimals)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Cash {formatUsd(hover.cash, decimals)}
              <span className="mx-1.5 text-slate-600">·</span>
              Positions {formatUsd(hover.positionsValue, decimals)}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
