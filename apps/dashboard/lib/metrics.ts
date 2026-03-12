import type { RoundTrip } from "./round-trip";
import type { BenchmarkData, MarketData } from "./benchmark";

/** Crypto markets trade 365 days/year (no weekends/holidays) */
export const TRADING_DAYS_PER_YEAR = 365;

/**
 * Daily equity and return series built from round-trips.
 * Uses a full calendar series (first to last trade date) with zero returns on non-trading days.
 * This ensures Sharpe and other risk metrics are not inflated by treating sparse "active days"
 * as if returns occurred every day.
 */
export function buildEquityCurve(
  roundTrips: RoundTrip[],
  initialEquity: number
): { dates: string[]; equity: number[]; returns: number[] } {
  if (roundTrips.length === 0) return { dates: [], equity: [], returns: [] };

  const byDay = new Map<string, number>();
  for (const rt of roundTrips) {
    const d = new Date(rt.sellDate * 1000).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + rt.pnl);
  }

  const allDates = [...byDay.keys()].sort((a, b) => a.localeCompare(b));
  const firstDate = allDates[0]!;
  const lastDate = allDates[allDates.length - 1]!;

  // Build full calendar series so mean/std are over true daily returns
  const dates: string[] = [];
  const equity: number[] = [];
  const returns: number[] = [];
  let e = initialEquity;
  const start = new Date(firstDate);
  const end = new Date(lastDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const pnl = byDay.get(dateStr) ?? 0;
    const r = e > 0 ? pnl / e : 0;
    e += pnl;
    dates.push(dateStr);
    equity.push(e);
    returns.push(r);
  }
  return { dates, equity, returns };
}

/** Align portfolio returns with benchmark by date */
function alignReturns(
  portfolio: { dates: string[]; returns: number[] },
  benchmark: BenchmarkData
): { p: number[]; b: number[] } {
  const bDateToReturn = new Map<string, number>();
  for (let i = 0; i < benchmark.dates.length; i++) {
    const d = new Date(benchmark.dates[i]! * 1000).toISOString().slice(0, 10);
    bDateToReturn.set(d, benchmark.returns[i] ?? 0);
  }
  const p: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < portfolio.dates.length; i++) {
    const d = portfolio.dates[i]!;
    const br = bDateToReturn.get(d);
    if (br !== undefined) {
      p.push(portfolio.returns[i] ?? 0);
      b.push(br);
    }
  }
  return { p, b };
}

// --- Stats helpers ---
function mean(x: number[]): number {
  if (x.length === 0) return 0;
  return x.reduce((a, b) => a + b, 0) / x.length;
}

function std(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  const v = x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  return Math.sqrt(v);
}

function sum(x: number[]): number {
  return x.reduce((a, b) => a + b, 0);
}

// --- 1. Return Metrics ---
export function computeReturnMetrics(
  roundTrips: RoundTrip[],
  equityCurve: { dates: string[]; equity: number[]; returns: number[] },
  initialEquity: number
) {
  const totalPnl = roundTrips.reduce((s, r) => s + r.pnl, 0);
  const totalReturn = initialEquity > 0 ? totalPnl / initialEquity : 0;
  const finalEquity = equityCurve.equity[equityCurve.equity.length - 1] ?? initialEquity;
  const cumulativeReturn = initialEquity > 0 ? (finalEquity - initialEquity) / initialEquity : 0;

  const rets = equityCurve.returns;
  const n = rets.length;
  const daysActive = equityCurve.dates.length;
  const years = Math.max(daysActive / TRADING_DAYS_PER_YEAR, 1 / TRADING_DAYS_PER_YEAR);

  const arithmeticMeanReturn = mean(rets);
  // CAGR: geometric annualization — (final/initial)^(1/years) - 1
  const cagr =
    years > 0 && initialEquity > 0 && finalEquity > 0
      ? (finalEquity / initialEquity) ** (1 / years) - 1
      : cumulativeReturn;
  const linearAnnualized = years > 0 ? cumulativeReturn / years : cumulativeReturn;
  const annualizedReturn = cagr;
  const geoReturn = cagr;

  // Rolling 30-day (approx) - use last 30 returns
  const rollWindow = Math.min(30, rets.length);
  const rollingReturn =
    rollWindow > 0
      ? rets.slice(-rollWindow).reduce((a, b) => a + b, 0)
      : 0;

  return {
    totalReturn,
    annualizedReturn,
    cagr,
    geometricReturn: geoReturn,
    arithmeticMeanReturn,
    rollingReturn,
    cumulativeReturn,
    totalPnl,
    initialEquity,
    finalEquity,
  };
}

// --- 2. Risk-Adjusted (need Rf and benchmark) ---
export function computeRiskAdjustedMetrics(
  equityCurve: { returns: number[]; dates: string[]; equity: number[] },
  marketData: MarketData,
  roundTrips: RoundTrip[]
) {
  const rets = equityCurve.returns;
  const rfDaily = marketData.riskFreeRateAnnual / 365;
  const rf = rets.map(() => rfDaily);
  const excessRets = rets.map((r, i) => r - rf[i]!);

  const vol = std(rets);
  const volAnn = vol * Math.sqrt(TRADING_DAYS_PER_YEAR);
  // Linear annualization: mean * 365 for returns, std * sqrt(365) for volatility
  const excessRetAnn = mean(excessRets) * TRADING_DAYS_PER_YEAR;
  const sharpe = volAnn > 0 ? excessRetAnn / volAnn : 0;

  const negRets = rets.filter((r) => r < 0);
  const downsideDevAnn = negRets.length > 0 ? std(negRets) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
  const sortino = downsideDevAnn > 0 ? excessRetAnn / downsideDevAnn : 0;

  const cspx = marketData.cspx;
  let infoRatio = 0;
  let treynor = 0;
  let modigliani = 0;
  let alpha = 0;
  let beta = 1;

  if (cspx && rets.length > 0) {
    const { p, b } = alignReturns(equityCurve, cspx);
    if (p.length > 1 && b.length > 1) {
      const actRets = p.map((r, i) => r - b[i]!);
      const te = std(actRets) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      infoRatio = te > 0 ? (mean(actRets) * TRADING_DAYS_PER_YEAR) / te : 0;
      const cov = p.reduce((s, _, i) => s + (p[i]! - mean(p)) * (b[i]! - mean(b)), 0) / (p.length - 1);
      const varB = std(b) ** 2;
      beta = varB > 0 ? cov / varB : 1;
      const rp = mean(p) * TRADING_DAYS_PER_YEAR;
      const rb = mean(b) * TRADING_DAYS_PER_YEAR;
      treynor = beta !== 0 ? (rp - marketData.riskFreeRateAnnual) / beta : 0;
      alpha = rp - (marketData.riskFreeRateAnnual + beta * (rb - marketData.riskFreeRateAnnual));
      const sharpeB = std(b) > 0 ? (mean(b) - rfDaily) / std(b) : 0;
      modigliani = volAnn > 0 ? sharpe * (volAnn / (std(b) * Math.sqrt(TRADING_DAYS_PER_YEAR) || 0.01)) : 0;
    }
  }

  const wins = roundTrips.filter((r) => r.pnl > 0);
  const losses = roundTrips.filter((r) => r.pnl < 0);
  const totalWin = sum(wins.map((r) => r.pnl));
  const totalLoss = Math.abs(sum(losses.map((r) => r.pnl)));
  const gainLossRatio = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 999 : 0;

  const maxDD = computeDrawdownMetrics(equityCurve).maxDrawdown;
  const calmar = maxDD < 0 ? (mean(rets) * TRADING_DAYS_PER_YEAR) / Math.abs(maxDD) : 0;

  const avgGain = wins.length > 0 ? totalWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
  const sterling = maxDD < 0 ? (mean(rets) * TRADING_DAYS_PER_YEAR) / Math.abs(maxDD) : 0; // similar to Calmar

  const omegaThreshold = 0;
  const gainsAbove = rets.filter((r) => r > omegaThreshold).reduce((a, b) => a + b, 0);
  const lossesBelow = Math.abs(rets.filter((r) => r < omegaThreshold).reduce((a, b) => a + b, 0));
  const omegaRatio = lossesBelow > 0 ? gainsAbove / lossesBelow : gainsAbove > 0 ? 999 : 0;

  const burkeDenom = volAnn || 0.01;
  const burke = excessRetAnn / burkeDenom;

  // Cap risk-adjusted ratios when sample size is small — estimated Sharpe has high variance
  // and can spuriously exceed 3. Realistic Sharpe >3 is extremely rare.
  const n = rets.length;
  const cap = n < 60 ? 3 : Infinity;
  const capRatio = (r: number) => (Number.isFinite(r) ? Math.min(r, cap) : r);

  return {
    sharpeRatio: capRatio(sharpe),
    sortinoRatio: capRatio(sortino),
    informationRatio: capRatio(infoRatio),
    treynorRatio: treynor,
    calmarRatio: capRatio(calmar),
    sterlingRatio: capRatio(sterling),
    omegaRatio: capRatio(omegaRatio),
    burkeRatio: capRatio(burke),
    gainLossRatio,
    modiglianiRatio: capRatio(modigliani),
    alpha,
    beta,
  };
}

// --- 3. Risk Metrics ---
export function computeRiskMetrics(
  equityCurve: { returns: number[] },
  roundTrips: RoundTrip[]
) {
  const rets = equityCurve.returns;
  const vol = std(rets);
  const volAnn = vol * Math.sqrt(TRADING_DAYS_PER_YEAR);

  const negRets = rets.filter((r) => r < 0);
  const downsideDev = negRets.length > 0 ? std(negRets) : 0;
  const semiVar = negRets.reduce((s, r) => s + r * r, 0) / Math.max(rets.length, 1);
  const semiDev = Math.sqrt(semiVar);

  const sorted = [...rets].sort((a, b) => a - b);
  const var95 = sorted[Math.floor(0.05 * sorted.length)] ?? 0;
  const var99 = sorted[Math.floor(0.01 * sorted.length)] ?? 0;
  const tailRets = sorted.slice(0, Math.ceil(0.05 * sorted.length));
  const cvar95 = tailRets.length > 0 ? mean(tailRets) : 0;

  const tailGain = rets.filter((r) => r > 0).sort((a, b) => b - a).slice(0, Math.ceil(0.05 * rets.length));
  const tailLoss = rets.filter((r) => r < 0).sort((a, b) => a - b).slice(0, Math.ceil(0.05 * rets.length));
  const avgTailGain = tailGain.length > 0 ? mean(tailGain) : 0;
  const avgTailLoss = tailLoss.length > 0 ? Math.abs(mean(tailLoss)) : 0;
  const tailRatio = avgTailLoss > 0 ? avgTailGain / avgTailLoss : avgTailGain > 0 ? 999 : 0;

  const m = mean(rets);
  const n = rets.length;
  const skew =
    n > 2 && vol > 0
      ? rets.reduce((s, r) => s + ((r - m) / vol) ** 3, 0) / n
      : 0;
  const kurt =
    n > 2 && vol > 0
      ? rets.reduce((s, r) => s + ((r - m) / vol) ** 4, 0) / n - 3
      : 0;

  const eq = (equityCurve as { equity?: number[] }).equity ?? [];
  let ulcerSum = 0;
  let peak = eq[0] ?? 0;
  for (const e of eq) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : 0;
    ulcerSum += dd * dd;
  }
  const ulcerIndex = eq.length > 0 ? Math.sqrt(ulcerSum / eq.length) * 100 : 0;

  const ddRets = eq.length > 1
    ? eq.slice(1).map((e, i) => (eq[i]! > 0 ? (eq[i]! - e) / eq[i]! : 0))
    : [];
  const drawdownDeviation = std(ddRets);

  return {
    volatility: volAnn,
    volatilityDaily: vol,
    downsideDeviation: downsideDev * Math.sqrt(TRADING_DAYS_PER_YEAR),
    semiVariance: semiVar,
    semiDeviation: semiDev,
    var95,
    var99,
    cvar95,
    tailRisk: cvar95,
    tailRatio,
    skewness: skew,
    kurtosis: kurt,
    ulcerIndex,
    drawdownDeviation,
  };
}

// --- 4. Drawdown Metrics ---
export function computeDrawdownMetrics(equityCurve: { equity: number[]; dates: string[] }) {
  const eq = equityCurve.equity;
  let peak = eq[0] ?? 0;
  let maxDD = 0;
  let ddSum = 0;
  let ddCount = 0;
  const drawdowns: number[] = [];
  let inDD = false;
  let ddStart = 0;
  let maxDuration = 0;
  let recoveryTime = 0;

  for (let i = 0; i < eq.length; i++) {
    const e = eq[i]!;
    if (e > peak) {
      if (inDD) {
        const dur = i - ddStart;
        if (dur > maxDuration) maxDuration = dur;
        recoveryTime = dur;
      }
      peak = e;
      inDD = false;
    } else {
      const dd = peak > 0 ? (peak - e) / peak : 0;
      if (dd > maxDD) maxDD = dd;
      drawdowns.push(dd);
      ddSum += dd;
      ddCount++;
      if (!inDD) {
        inDD = true;
        ddStart = i;
      }
    }
  }
  if (inDD) {
    const dur = eq.length - ddStart;
    if (dur > maxDuration) maxDuration = dur;
    recoveryTime = dur;
  }

  const avgDrawdown = ddCount > 0 ? ddSum / ddCount : 0;
  const painIndex = ddCount > 0 ? ddSum / ddCount : 0;
  const ret = mean(
    equityCurve.equity.length > 1
      ? equityCurve.equity.slice(1).map((e, i) =>
          (equityCurve.equity[i] ?? 0) > 0
            ? (e - (equityCurve.equity[i] ?? 0)) / (equityCurve.equity[i] ?? 0)
            : 0
        )
      : [0]
  );
  const painRatio = painIndex > 0 ? ret / painIndex : 0;

  return {
    maxDrawdown: -maxDD,
    averageDrawdown: -avgDrawdown,
    drawdownDuration: maxDuration,
    recoveryTime,
    painIndex,
    painRatio,
  };
}

// --- 5. Market Exposure (already in risk-adjusted) ---
// --- 6. Portfolio Efficiency ---
export function computePortfolioEfficiency(
  equityCurve: { returns: number[] },
  drawdownMetrics: { maxDrawdown: number }
) {
  const ret = mean(equityCurve.returns) * TRADING_DAYS_PER_YEAR;
  const romad = drawdownMetrics.maxDrawdown < 0
    ? ret / Math.abs(drawdownMetrics.maxDrawdown)
    : 0;
  const calmar = romad; // same
  return { returnOverMaxDrawdown: romad, calmarRatio: calmar };
}

// --- 7. Trade-Level Metrics ---
export function computeTradeMetrics(roundTrips: RoundTrip[]) {
  const wins = roundTrips.filter((r) => r.pnl > 0);
  const losses = roundTrips.filter((r) => r.pnl <= 0);
  const winRate = roundTrips.length > 0 ? wins.length / roundTrips.length : 0;
  const lossRate = roundTrips.length > 0 ? losses.length / roundTrips.length : 0;

  const avgWin = wins.length > 0 ? sum(wins.map((r) => r.pnl)) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(sum(losses.map((r) => r.pnl))) / losses.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map((r) => r.pnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.max(...losses.map((r) => Math.abs(r.pnl))) : 0;

  const grossProfit = sum(wins.map((r) => r.pnl));
  const grossLoss = Math.abs(sum(losses.map((r) => r.pnl)));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const expectancy = roundTrips.length > 0 ? sum(roundTrips.map((r) => r.pnl)) / roundTrips.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;
  const riskReward = payoffRatio;

  const avgHoldingDays = roundTrips.length > 0
    ? sum(roundTrips.map((r) => r.holdingDays)) / roundTrips.length
    : 0;

  const firstTs = roundTrips[0]?.buyDate ?? 0;
  const lastTs = roundTrips[roundTrips.length - 1]?.sellDate ?? 0;
  const daysSpan = lastTs > firstTs ? (lastTs - firstTs) / 86400 : 1;
  const tradeFrequency = daysSpan > 0 ? roundTrips.length / daysSpan : 0;

  return {
    winRate,
    lossRate,
    averageWin: avgWin,
    averageLoss: avgLoss,
    largestWin,
    largestLoss,
    profitFactor,
    expectancy,
    payoffRatio,
    riskRewardRatio: riskReward,
    averageHoldingTime: avgHoldingDays,
    tradeFrequency,
  };
}

// --- 8. Distribution Metrics ---
export function computeDistributionMetrics(equityCurve: { returns: number[] }) {
  const rets = equityCurve.returns;
  const sorted = [...rets].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(0.05 * sorted.length)] ?? 0;
  const p25 = sorted[Math.floor(0.25 * sorted.length)] ?? 0;
  const p50 = sorted[Math.floor(0.5 * sorted.length)] ?? 0;
  const p75 = sorted[Math.floor(0.75 * sorted.length)] ?? 0;
  const p95 = sorted[Math.floor(0.95 * sorted.length)] ?? 0;

  return {
    meanReturn: mean(rets),
    medianReturn: p50,
    variance: std(rets) ** 2,
    standardDeviation: std(rets),
    skewness: 0, // computed in risk
    kurtosis: 0,
    percentile5: p5,
    percentile25: p25,
    percentile50: p50,
    percentile75: p75,
    percentile95: p95,
  };
}

// --- 9. Tail/Stress ---
export function computeTailMetrics(equityCurve: { returns: number[]; equity: number[] }) {
  const rets = equityCurve.returns;
  const sorted = [...rets].sort((a, b) => a - b);
  const worst = sorted[0] ?? 0;
  const stressLoss = worst;
  const tailRets = sorted.slice(0, Math.ceil(0.05 * rets.length));
  const tce = tailRets.length > 0 ? mean(tailRets) : 0;

  return {
    stressLoss,
    tailConditionalExpectation: tce,
    historicalStressTest: worst,
  };
}

// --- 10. Liquidity (prediction markets - N/A for most, placeholders) ---
export function computeLiquidityMetrics() {
  return {
    bidAskSpread: null as number | null,
    marketImpactCost: null as number | null,
    slippage: null as number | null,
    liquidityRatio: null as number | null,
    daysToLiquidate: null as number | null,
  };
}

// --- 11. Benchmark Comparison ---
export function computeBenchmarkComparison(
  equityCurve: { returns: number[]; dates: string[] },
  marketData: MarketData
) {
  const cspx = marketData.cspx;
  if (!cspx) {
    return {
      trackingError: null as number | null,
      informationRatio: null as number | null,
      activeReturn: null as number | null,
      alpha: null as number | null,
      beta: null as number | null,
      relativeDrawdown: null as number | null,
    };
  }
  const { p, b } = alignReturns(equityCurve, cspx);
  if (p.length < 2) return { trackingError: null, informationRatio: null, activeReturn: null, alpha: null, beta: null, relativeDrawdown: null };

  const actRets = p.map((r, i) => r - b[i]!);
  const te = std(actRets) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const ir = te > 0 ? (mean(actRets) * TRADING_DAYS_PER_YEAR) / te : 0;
  const actRet = mean(actRets) * TRADING_DAYS_PER_YEAR;
  const cov = p.reduce((s, _, i) => s + (p[i]! - mean(p)) * (b[i]! - mean(b)), 0) / (p.length - 1);
  const beta = std(b) ** 2 > 0 ? cov / (std(b) ** 2) : 1;
  const rp = mean(p) * TRADING_DAYS_PER_YEAR;
  const rb = mean(b) * TRADING_DAYS_PER_YEAR;
  const alpha = rp - (marketData.riskFreeRateAnnual + beta * (rb - marketData.riskFreeRateAnnual));

  return {
    trackingError: te,
    informationRatio: ir,
    activeReturn: actRet,
    alpha,
    beta,
    relativeDrawdown: null as number | null,
  };
}

// --- 12. Portfolio Construction ---
export function computePortfolioConstruction(roundTrips: RoundTrip[]) {
  const byMarket = new Map<string, number>();
  for (const r of roundTrips) {
    byMarket.set(r.title, (byMarket.get(r.title) ?? 0) + Math.abs(r.pnl));
  }
  const weights = [...byMarket.values()];
  const total = sum(weights);
  const w = weights.map((x) => (total > 0 ? x / total : 0));
  const hhi = sum(w.map((x) => x * x));
  const conc = hhi;

  return {
    diversificationRatio: 1 / (Math.sqrt(hhi) || 0.01),
    concentration: conc,
    herfindahlIndex: hhi,
  };
}

// --- 14. Capital Efficiency / Risk of Ruin ---
export function computeCapitalEfficiency(
  roundTrips: RoundTrip[],
  equityCurve: { returns: number[] },
  initialEquity: number
) {
  const wins = roundTrips.filter((r) => r.pnl > 0);
  const losses = roundTrips.filter((r) => r.pnl < 0);
  const winRate = roundTrips.length > 0 ? wins.length / roundTrips.length : 0.5;
  const avgWin = wins.length > 0 ? sum(wins.map((r) => r.pnl)) / wins.length : 0;
  const avgLoss = losses.length > 0 ? sum(losses.map((r) => Math.abs(r.pnl))) / losses.length : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 999;
  const kelly = winRate - (1 - winRate) / payoff;
  const kellyFraction = Math.max(0, Math.min(1, kelly));

  const ret = mean(equityCurve.returns) * TRADING_DAYS_PER_YEAR;
  const vol = std(equityCurve.returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const riskOfRuin = vol > 0 ? Math.exp(-2 * ret * (initialEquity / (vol * initialEquity || 1))) : 0;

  return {
    kellyFraction,
    kellyCriterion: kelly,
    riskOfRuin,
    expectedGrowthRate: ret,
    leverageRatio: 1,
  };
}

export function computeExcessReturn(
  totalReturn: number,
  marketData: MarketData,
  years: number
): number {
  // Linear annualization: mean daily * 365 * years = cumulative return equivalent
  const benchReturn = marketData.cspx && years > 0
    ? mean(marketData.cspx.returns) * TRADING_DAYS_PER_YEAR * years
    : 0;
  return totalReturn - benchReturn;
}
