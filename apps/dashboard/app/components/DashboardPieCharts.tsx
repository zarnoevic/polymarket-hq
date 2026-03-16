"use client";

import dynamic from "next/dynamic";
import type { Position } from "./PositionsList";

const chartCardClass =
  "h-[460px] w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col";

function PieChartSkeleton({ title }: { title: string }) {
  return (
    <div className={chartCardClass}>
      <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    </div>
  );
}

const CategoryCompositionPieChart = dynamic(
  () =>
    import("./CategoryCompositionPieChart").then((m) => ({
      default: m.CategoryCompositionPieChart,
    })),
  { ssr: false, loading: () => <PieChartSkeleton title="By category (allocation)" /> }
);

const CategoryAttributionPieChart = dynamic(
  () =>
    import("./CategoryAttributionPieChart").then((m) => ({
      default: m.CategoryAttributionPieChart,
    })),
  { ssr: false, loading: () => <PieChartSkeleton title="24h attribution by category" /> }
);

const AttributionPieChart = dynamic(
  () =>
    import("./AttributionPieChart").then((m) => ({
      default: m.AttributionPieChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm flex flex-col">
        <h3 className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Attribution (24h)
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        </div>
      </div>
    ),
  }
);

export function DashboardPieCharts({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet: string;
}) {
  return (
    <>
      <CategoryCompositionPieChart positions={positions} wallet={wallet} />
      <CategoryAttributionPieChart positions={positions} wallet={wallet} />
      <AttributionPieChart positions={positions} />
    </>
  );
}
