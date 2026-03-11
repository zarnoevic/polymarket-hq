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

/** ROI numeric: (1 - p) / p for quoted probability p. */
export function computeROINumeric(avgPrice: number): number | null {
  if (avgPrice <= 0 || avgPrice >= 1 || !Number.isFinite(avgPrice)) return null;
  const roi = (1 - avgPrice) / avgPrice;
  return Number.isFinite(roi) ? roi : null;
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

/** ROI: &lt; 1 → %, ≥ 1 → x (e.g. 0.5 → 50%, 1.5 → 1.5x). */
export function formatRoi(roi: number): string {
  if (roi < 0 || !Number.isFinite(roi)) return "—";
  if (roi >= 1) return formatRoiAsX(roi);
  const pct = roi * 100;
  return `${pct.toFixed(1)}%`;
}

export function computePositionAverages(positions: PositionForMetrics[]): {
  avgParoi: number | null;
  avgRoi: number | null;
  avgPositionSize: number;
  avgProfit: number;
  avgBettedChance: number | null;
  avgCurrentChance: number | null;
} {
  if (positions.length === 0) {
    return { avgParoi: null, avgRoi: null, avgPositionSize: 0, avgProfit: 0, avgBettedChance: null, avgCurrentChance: null };
  }

  const paroiValues: number[] = [];
  const roiValues: number[] = [];
  const bettedChanceValues: number[] = [];
  const currentChanceValues: number[] = [];
  let sumSize = 0;
  let sumProfit = 0;

  for (const pos of positions) {
    const days = daysToResolution(pos.endDate, pos.title);
    const paroi = computePAROINumeric(pos.curPrice, days);
    if (Number.isFinite(paroi) && paroi > -Infinity) {
      paroiValues.push(paroi);
    }
    const roi = computeROINumeric(pos.avgPrice);
    if (roi != null) {
      roiValues.push(roi);
    }
    if (pos.avgPrice > 0 && pos.avgPrice < 1 && Number.isFinite(pos.avgPrice)) {
      bettedChanceValues.push(pos.avgPrice);
    }
    if (pos.curPrice > 0 && pos.curPrice < 1 && Number.isFinite(pos.curPrice)) {
      currentChanceValues.push(pos.curPrice);
    }
    sumSize += Math.abs(pos.currentValue);
    sumProfit += pos.cashPnl;
  }

  const avgParoi =
    paroiValues.length > 0
      ? paroiValues.reduce((a, b) => a + b, 0) / paroiValues.length
      : null;
  const avgRoi =
    roiValues.length > 0
      ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length
      : null;
  const avgPositionSize = positions.length > 0 ? sumSize / positions.length : 0;
  const avgProfit = positions.length > 0 ? sumProfit / positions.length : 0;
  const avgBettedChance =
    bettedChanceValues.length > 0
      ? bettedChanceValues.reduce((a, b) => a + b, 0) / bettedChanceValues.length
      : null;
  const avgCurrentChance =
    currentChanceValues.length > 0
      ? currentChanceValues.reduce((a, b) => a + b, 0) / currentChanceValues.length
      : null;

  return { avgParoi, avgRoi, avgPositionSize, avgProfit, avgBettedChance, avgCurrentChance };
}

/** Product of probabilities: chance that all positions win (assuming independence). */
export function computeTotalWinChances(positions: PositionForMetrics[]): {
  chanceTotalWin: number | null;
  initialChanceTotalWin: number | null;
} {
  if (positions.length === 0) {
    return { chanceTotalWin: null, initialChanceTotalWin: null };
  }
  let current = 1;
  let initial = 1;
  let hasCurrent = false;
  let hasInitial = false;
  for (const pos of positions) {
    if (pos.curPrice >= 0 && pos.curPrice <= 1 && Number.isFinite(pos.curPrice)) {
      current *= pos.curPrice;
      hasCurrent = true;
    }
    if (pos.avgPrice >= 0 && pos.avgPrice <= 1 && Number.isFinite(pos.avgPrice)) {
      initial *= pos.avgPrice;
      hasInitial = true;
    }
  }
  return {
    chanceTotalWin: hasCurrent ? current : null,
    initialChanceTotalWin: hasInitial ? initial : null,
  };
}
