"use client";

import type { Position } from "./PositionsList";
import { CategoryAttributionPieChart } from "./CategoryAttributionPieChart";
import { AttributionPieChart } from "./AttributionPieChart";

export function DashboardPieCharts({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <AttributionPieChart positions={positions} />
      <CategoryAttributionPieChart positions={positions} wallet={wallet} />
    </div>
  );
}
