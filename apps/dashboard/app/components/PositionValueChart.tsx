"use client";

import type { PositionValuePoint } from "@/lib/position-metrics";

type PositionValueChartProps = {
  data: PositionValuePoint[];
  className?: string;
};

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

export function PositionValueChart({ data, className = "" }: PositionValueChartProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = { top: 8, right: 8, bottom: 24, left: 40 };
  const w = 200;
  const h = 100;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const xScale = (i: number) =>
    padding.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) =>
    padding.top + chartH - ((v - minVal) / range) * chartH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.value)}`)
    .join(" ");

  const firstDate = data[0]!.date;
  const lastDate = data[data.length - 1]!.date;
  const labelFirst =
    firstDate.slice(5) === lastDate.slice(5)
      ? firstDate.slice(5)
      : firstDate.slice(0, 7);
  const labelLast = lastDate.slice(5);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10 ${className}`}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Position Value
      </h3>
      <svg
        width={w}
        height={h}
        className="overflow-visible"
        aria-label="Total position value over time"
        role="img"
      >
        <defs>
          <linearGradient
            id="position-value-gradient"
            x1="0"
            y1="1"
            x2="0"
            y2="0"
          >
            <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity="0" />
            <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path
          d={`${pathD} L ${xScale(data.length - 1)} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`}
          fill="url(#position-value-gradient)"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="rgb(139 92 246)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Y-axis labels */}
        <text
          x={padding.left - 4}
          y={padding.top}
          textAnchor="end"
          alignmentBaseline="hanging"
          className="fill-slate-500 text-[9px] font-medium"
        >
          {formatCompact(maxVal)}
        </text>
        <text
          x={padding.left - 4}
          y={padding.top + chartH}
          textAnchor="end"
          alignmentBaseline="baseline"
          className="fill-slate-500 text-[9px] font-medium"
        >
          {formatCompact(minVal)}
        </text>
        {/* X-axis labels */}
        <text
          x={padding.left}
          y={h - 4}
          textAnchor="start"
          className="fill-slate-500 text-[9px] font-medium"
        >
          {labelFirst}
        </text>
        <text
          x={w - padding.right}
          y={h - 4}
          textAnchor="end"
          className="fill-slate-500 text-[9px] font-medium"
        >
          {labelLast}
        </text>
      </svg>
    </div>
  );
}
