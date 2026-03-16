"use client";

import type { Position } from "./PositionsList";
import { CategoryCompositionPieChart } from "./CategoryCompositionPieChart";
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
      <CategoryCompositionPieChart positions={positions} wallet={wallet} />
      <CategoryAttributionPieChart positions={positions} wallet={wallet} />
      <AttributionPieChart positions={positions} />
    </div>
  );
}
