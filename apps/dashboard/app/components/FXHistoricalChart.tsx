"use client";

import { useState, useRef, useCallback } from "react";

type Point = { date: string; rate: number };

export function FXHistoricalChart({
  history,
  currentRate,
  className,
}: {
  history: Point[];
  currentRate: number;
  className?: string;
}) {
  const [hover, setHover] = useState<{ clientX: number; clientY: number; point: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const lastDate = history.length > 0 ? history[history.length - 1]!.date : null;
  const points: Point[] =
    history.length >= 1
      ? lastDate === todayStr
        ? history
        : [...history, { date: todayStr, rate: currentRate }]
      : [];

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length < 2 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const idx = Math.min(Math.floor(pct * points.length), points.length - 1);
      const point = points[Math.max(0, idx)]!;
      setHover({ clientX: e.clientX, clientY: e.clientY, point });
    },
    [points]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  if (points.length < 2) {
    return (
      <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 ${className ?? ""}`}>
        <p className="text-center text-sm text-slate-500">
          Set EXCHANGE_RATE_API_KEY for historical chart
        </p>
      </div>
    );
  }

  const rates = points.map((p) => p.rate);
  const minR = Math.min(...rates);
  const maxR = Math.max(...rates);
  const range = maxR - minR || 0.01;
  const pad = 24;
  const w = 400;
  const h = 160;

  const xScale = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const yScale = (r: number) => h - pad - ((r - minR) / range) * (h - 2 * pad);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.rate)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${xScale(points.length - 1)} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <div
      className={`relative rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden ${className ?? ""}`}
    >
      <div className="px-4 pt-3">
        <p className="text-xs text-slate-500">Historical 1 EUR = ? RSD</p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-40 block"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="fxArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#fxArea)" />
        <path
          d={pathD}
          fill="none"
          stroke="rgb(99 102 241)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full -mt-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 shadow-xl text-sm whitespace-nowrap"
          style={{ left: hover.clientX, top: hover.clientY }}
        >
          <span className="text-slate-400">{hover.point.date}</span>
          <br />
          <span className="font-semibold text-beige">
            1 EUR = {hover.point.rate.toFixed(2)} RSD
          </span>
        </div>
      )}
    </div>
  );
}
