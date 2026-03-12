/**
 * Diagnostic endpoint: returns all underlying values used to compute portfolio ratios.
 * Hit GET /api/diagnose-metrics to inspect why ratios may be extremely high.
 */
import { NextResponse } from "next/server";
import { fetchActivity, getInitialEquity } from "@/lib/polymarket";
import { fetchMarketData } from "@/lib/benchmark";
import { matchRoundTrips } from "@/lib/round-trip";
import {
  TRADING_DAYS_PER_YEAR,
  buildEquityCurve,
  computeReturnMetrics,
  computeRiskAdjustedMetrics,
  computeRiskMetrics,
  computeDrawdownMetrics,
} from "@/lib/metrics";

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

export async function GET() {
  try {
    const [trades, marketData] = await Promise.all([
      fetchActivity(),
      fetchMarketData(),
    ]);

    const roundTrips = matchRoundTrips(trades);
    const totalBuyVolume = roundTrips.reduce((s, r) => s + r.buyUsdc, 0);
    const initialEquity = getInitialEquity(totalBuyVolume);

    const equityCurve = buildEquityCurve(roundTrips, initialEquity);
    const returnMetrics = computeReturnMetrics(roundTrips, equityCurve, initialEquity);
    const riskAdjusted = computeRiskAdjustedMetrics(equityCurve, marketData, roundTrips);
    const riskMetrics = computeRiskMetrics(equityCurve, roundTrips);
    const drawdownMetrics = computeDrawdownMetrics(equityCurve);

    const rets = equityCurve.returns;
    const rfDaily = marketData.riskFreeRateAnnual / 365;
    const excessRets = rets.map((r) => r - rfDaily);
    const meanDailyRet = mean(rets);
    const stdDaily = std(rets);
    const volAnn = stdDaily * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const excessRetAnn = mean(excessRets) * TRADING_DAYS_PER_YEAR;
    const sharpeRaw = volAnn > 0 ? excessRetAnn / volAnn : 0;
    const years = Math.max(rets.length / TRADING_DAYS_PER_YEAR, 1 / TRADING_DAYS_PER_YEAR);

    const activeDays = rets.filter((r) => r !== 0).length;
    const zeroDays = rets.length - activeDays;

    const diagnostic = {
      input: {
        tradesFetched: trades.length,
        roundTrips: roundTrips.length,
        totalBuyVolume,
        initialEquity,
        firstSellDate:
          roundTrips[0] != null
            ? new Date(roundTrips[0].sellDate * 1000).toISOString().slice(0, 10)
            : null,
        lastSellDate:
          roundTrips[roundTrips.length - 1] != null
            ? new Date(
                roundTrips[roundTrips.length - 1]!.sellDate * 1000
              ).toISOString().slice(0, 10)
            : null,
        totalPnl: roundTrips.reduce((s, r) => s + r.pnl, 0),
        wins: roundTrips.filter((r) => r.pnl > 0).length,
        losses: roundTrips.filter((r) => r.pnl <= 0).length,
        riskFreeRateAnnual: marketData.riskFreeRateAnnual,
      },
      equityCurve: {
        calendarDays: rets.length,
        activeDays,
        zeroDays,
        firstDate: equityCurve.dates[0] ?? null,
        lastDate: equityCurve.dates[equityCurve.dates.length - 1] ?? null,
        initialEquity: equityCurve.equity[0] ?? initialEquity,
        finalEquity: equityCurve.equity[equityCurve.equity.length - 1] ?? initialEquity,
        sampleReturnsFirst10: rets.slice(0, 10),
        sampleReturnsLast10: rets.slice(-10),
        nonZeroReturns: rets.filter((r) => r !== 0).slice(0, 20),
      },
      underlyingForRatios: {
        meanDailyReturn: meanDailyRet,
        meanDailyReturnPct: (meanDailyRet * 100).toFixed(4) + "%",
        stdDailyReturn: stdDaily,
        stdDailyReturnPct: (stdDaily * 100).toFixed(4) + "%",
        volAnnualized: volAnn,
        volAnnualizedPct: (volAnn * 100).toFixed(2) + "%",
        excessRetAnnualized: excessRetAnn,
        excessRetAnnualizedPct: (excessRetAnn * 100).toFixed(2) + "%",
        years,
        sharpeRaw,
        sharpeCapped: riskAdjusted.sharpeRatio,
        maxDrawdown: drawdownMetrics.maxDrawdown,
        maxDrawdownPct: (drawdownMetrics.maxDrawdown * 100).toFixed(2) + "%",
      },
      computedMetrics: {
        returnMetrics: {
          totalReturn: returnMetrics.totalReturn,
          cumulativeReturn: returnMetrics.cumulativeReturn,
          cagr: returnMetrics.cagr,
        },
        riskAdjusted: {
          sharpeRatio: riskAdjusted.sharpeRatio,
          sortinoRatio: riskAdjusted.sortinoRatio,
          calmarRatio: riskAdjusted.calmarRatio,
          sterlingRatio: riskAdjusted.sterlingRatio,
          omegaRatio: riskAdjusted.omegaRatio,
          burkeRatio: riskAdjusted.burkeRatio,
          gainLossRatio: riskAdjusted.gainLossRatio,
        },
        risk: {
          volatility: riskMetrics.volatility,
          downsideDeviation: riskMetrics.downsideDeviation,
        },
      },
      flags: {
        isSparseTrading: activeDays < rets.length * 0.2,
        isSmallSample: rets.length < 60,
        isHighMeanLowVol:
          meanDailyRet > 0.001 && stdDaily < 0.005,
      },
      analysis: {
        whyRatiosMayBeHigh: [
          ...(initialEquity < totalBuyVolume * 0.5
            ? [
                `Initial equity ($${initialEquity.toLocaleString()}) may underestimate real capital. Formula uses max(10k, totalBuyVolume×0.3). If you had more capital deployed, returns would be lower.`,
              ]
            : []),
          activeDays < rets.length * 0.3
            ? `Sparse trading: only ${activeDays} days with closed trades out of ${rets.length} calendar days. Returns are concentrated on few days.`
            : null,
          Math.abs(drawdownMetrics.maxDrawdown) < 0.05
            ? `Very small max drawdown (${(drawdownMetrics.maxDrawdown * 100).toFixed(2)}%) inflates Calmar/Sterling: return ÷ |drawdown| becomes huge.`
            : null,
          years < 0.5
            ? `Short period (~${(years * 12).toFixed(0)} months). Ratios can be noisy over short windows.`
            : null,
        ].filter(Boolean),
        initialEquityFormula: "max(10_000, totalBuyVolume × 0.3)",
        suggestedCheck:
          initialEquity < totalBuyVolume
            ? `Your actual capital at risk may be higher than $${initialEquity.toLocaleString()}. Consider setting POLYMARKET_INITIAL_EQUITY env if you know it.`
            : null,
      },
    };

    return NextResponse.json(diagnostic, { status: 200 });
  } catch (err) {
    console.error("diagnose-metrics error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
