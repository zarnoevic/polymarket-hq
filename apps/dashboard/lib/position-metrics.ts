/**
 * Shared position metrics (PAROI, days to resolution, averages).
 */

export type PositionForMetrics = {
  curPrice: number;
  avgPrice: number;
  endDate: string;
  title?: string;
  size: number;
  currentValue: number;
  cashPnl: number;
};

/** Extract date from title, e.g. "by March 15" or "March 31" */
function parseDateFromTitle(title: string): Date | null {
  const m = title.match(
    /(?:by\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})/i
  );
  if (!m) return null;
  const year = new Date().getFullYear();
  const d = new Date(`${m[1]} ${m[2]}, ${year}`);
  if (isNaN(d.getTime())) return null;
  if (d < new Date()) d.setFullYear(year + 1);
  return d;
}

/** Days until resolution; null if endDate missing or in the past. */
export function daysToResolution(
  endDateStr: string,
  title?: string
): number | null {
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
  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const days = Math.round(
    (resUtc - todayUtc) / (24 * 60 * 60 * 1000)
  );
  return days > 0 ? Math.max(1, days) : null;
}

/** PAROI (Present) numeric: r = (1-P)/P, annualized. */
export function computePAROINumeric(
  curPrice: number,
  days: number | null
): number {
  if (curPrice <= 0) return -Infinity;
  if (days == null || days <= 0) return -Infinity;
  const r = (1 - curPrice) / curPrice;
  return r * (365 / days);
}

/** ROI as "Xx" where 1x = 100% return. */
export function formatRoiAsX(roi: number): string {
  if (roi < 0 || !Number.isFinite(roi)) return "—";
  if (roi >= 1_000_000_000_000) {
    const t = roi / 1_000_000_000_000;
    return t >= 999.9 ? "999+Tx" : `${t.toFixed(1)}Tx`;
  }
  if (roi >= 1_000_000_000) return `${(roi / 1_000_000_000).toFixed(1)}Bx`;
  if (roi >= 1_000_000) return `${(roi / 1_000_000).toFixed(1)}Mx`;
  if (roi >= 1_000) return `${(roi / 1_000).toFixed(1)}Kx`;
  if (roi >= 100) return `${roi.toFixed(1)}x`;
  if (roi >= 10) return `${roi.toFixed(1)}x`;
  if (roi >= 1) return `${roi.toFixed(2)}x`;
  return `${roi.toFixed(2)}x`;
}

export function computePositionAverages(positions: PositionForMetrics[]): {
  avgParoi: number | null;
  avgPositionSize: number;
  avgProfit: number;
} {
  if (positions.length === 0) {
    return { avgParoi: null, avgPositionSize: 0, avgProfit: 0 };
  }

  const paroiValues: number[] = [];
  let sumSize = 0;
  let sumProfit = 0;

  for (const pos of positions) {
    const days = daysToResolution(pos.endDate, pos.title);
    const paroi = computePAROINumeric(pos.curPrice, days);
    if (Number.isFinite(paroi) && paroi > -Infinity) {
      paroiValues.push(paroi);
    }
    sumSize += Math.abs(pos.currentValue);
    sumProfit += pos.cashPnl;
  }

  const avgParoi =
    paroiValues.length > 0
      ? paroiValues.reduce((a, b) => a + b, 0) / paroiValues.length
      : null;
  const avgPositionSize = positions.length > 0 ? sumSize / positions.length : 0;
  const avgProfit = positions.length > 0 ? sumProfit / positions.length : 0;

  return { avgParoi, avgPositionSize, avgProfit };
}

/** Activity entry for position value computation */
export type ActivityEntryForValue = {
  timestamp: number;
  asset: string;
  side: "BUY" | "SELL";
  size: number;
  usdcSize: number;
};

export type PositionValuePoint = { date: string; value: number; timestamp: number };

/**
 * Build position value (cost basis) over time from trade activity.
 * Uses FIFO cost basis. Optionally scales to match current totalValue for consistency.
 */
export function buildPositionValueOverTime(
  activity: ActivityEntryForValue[],
  totalValue: number | null
): PositionValuePoint[] {
  const sorted = [...activity].sort((a, b) => a.timestamp - b.timestamp);
  const inventory = new Map<
    string,
    Array<{ size: number; cost: number }>
  >();

  const points: PositionValuePoint[] = [];

  for (const t of sorted) {
    const key = t.asset;
    if (!inventory.has(key)) inventory.set(key, []);
    const queue = inventory.get(key)!;

    if (t.side === "BUY") {
      queue.push({ size: t.size, cost: t.usdcSize });
    } else {
      let remaining = t.size;
      while (remaining > 0 && queue.length > 0) {
        const first = queue[0]!;
        const match = Math.min(first.size, remaining);
        const costPerUnit = first.size > 0 ? first.cost / first.size : 0;
        const costDeducted = costPerUnit * match;
        first.size -= match;
        first.cost -= costDeducted;
        remaining -= match;
        if (first.size <= 0) queue.shift();
      }
    }

    const totalCost = [...inventory.values()].reduce(
      (sum, q) => sum + q.reduce((s, x) => s + x.cost, 0),
      0
    );
    const date = new Date(t.timestamp * 1000).toISOString().slice(0, 10);
    points.push({ date, value: totalCost, timestamp: t.timestamp });
  }

  if (points.length === 0) return [];

  // Scale to match current totalValue if available (keeps shape, aligns endpoint)
  const lastCost = points[points.length - 1]!.value;
  if (
    totalValue != null &&
    totalValue > 0 &&
    lastCost > 0
  ) {
    const scale = totalValue / lastCost;
    return points.map((p) => ({ ...p, value: p.value * scale }));
  }

  return points;
}
