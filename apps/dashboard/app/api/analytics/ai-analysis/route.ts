import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  fetchActivity,
  getInitialEquity,
} from "../../../../lib/polymarket";
import { fetchMarketData } from "../../../../lib/benchmark";
import { matchRoundTrips } from "../../../../lib/round-trip";
import {
  buildEquityCurve,
  computeReturnMetrics,
  computeRiskAdjustedMetrics,
  computeRiskMetrics,
  computeDrawdownMetrics,
  computePortfolioEfficiency,
  computeTradeMetrics,
  computeDistributionMetrics,
  computeTailMetrics,
  computeBenchmarkComparison,
  computePortfolioConstruction,
  computeCapitalEfficiency,
  computeExcessReturn,
} from "../../../../lib/metrics";

function fmt(val: number, pct = false): string {
  if (pct) return `${(val * 100).toFixed(2)}%`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function buildPrompt(
  trades: Awaited<ReturnType<typeof fetchActivity>>,
  roundTrips: ReturnType<typeof matchRoundTrips>,
  metrics: Record<string, unknown>
): string {
  const buyVol = trades.filter((t) => t.side === "BUY").reduce((s, t) => s + t.usdcSize, 0);
  const sellVol = trades.filter((t) => t.side === "SELL").reduce((s, t) => s + t.usdcSize, 0);
  const totalPositions = new Set(trades.map((t) => t.asset)).size;
  const initialEquity = (metrics.initialEquity as number) ?? 0;
  const finalEquity = (metrics.finalEquity as number) ?? 0;

  const topMarkets = [...new Map(roundTrips.map((r) => [r.title, r])).entries()]
    .map(([title]) => ({
      title,
      vol: roundTrips.filter((x) => x.title === title).reduce((s, x) => s + x.buyUsdc + x.sellUsdc, 0),
    }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 10)
    .map((m) => `  - "${m.title}": ${fmt(m.vol)}`)
    .join("\n");

  return `You are an expert trading analyst for prediction markets (Polymarket). Ignore what the prediction markets say, whether you read that in some article or not. Make your own independent decision based on merit, not crowd opinion. Analyze the following trading data and provide a structured analysis.

## TRADING OVERVIEW
| Metric | Value |
|--------|-------|
| Total trades | ${trades.length} |
| Round-trips (closed) | ${roundTrips.length} |
| Unique positions held | ${totalPositions} |
| Buy volume | ${fmt(buyVol)} |
| Sell volume | ${fmt(sellVol)} |
| Initial equity (est.) | ${fmt(initialEquity)} |
| Final equity (est.) | ${fmt(finalEquity)} |

## TOP MARKETS BY VOLUME
${topMarkets || "(none)"}

## TRADING HISTORY (last 50 round-trips, newest first)
| Market | Buy | Sell | Cost | Proceeds | PnL | % | Days |
|--------|-----|------|------|----------|-----|---|------|
${roundTrips.slice(-50).reverse().map((r) => {
  const buyDate = new Date(r.buyDate * 1000).toISOString().slice(0, 10);
  const sellDate = new Date(r.sellDate * 1000).toISOString().slice(0, 10);
  const pnlSign = r.pnl >= 0 ? "+" : "";
  const title = r.title.replace(/\|/g, " ").slice(0, 50);
  return `| ${title} | ${buyDate} | ${sellDate} | $${r.buyUsdc.toFixed(0)} | $${r.sellUsdc.toFixed(0)} | ${pnlSign}$${r.pnl.toFixed(2)} | ${r.percentPnl >= 0 ? "+" : ""}${r.percentPnl.toFixed(1)}% | ${r.holdingDays.toFixed(0)} |`;
}).join("\n") || "(none)"}

## PERFORMANCE METRICS (all computed from the above)

### 1. Returns
- Total PnL: ${fmt((metrics.totalPnl as number) ?? 0)}
- Total return: ${fmt((metrics.totalReturn as number) ?? 0, true)}
- CAGR: ${fmt((metrics.cagr as number) ?? 0, true)}
- Annualized return: ${fmt((metrics.annualizedReturn as number) ?? 0, true)}
- Rolling 30d return: ${fmt((metrics.rollingReturn as number) ?? 0, true)}
- Excess return vs CSPX: ${fmt((metrics.excessReturn as number) ?? 0, true)}

### 2. Risk-adjusted
- Sharpe ratio: ${((metrics.sharpeRatio as number) ?? 0).toFixed(2)}
- Sortino ratio: ${((metrics.sortinoRatio as number) ?? 0).toFixed(2)}
- Calmar ratio: ${((metrics.calmarRatio as number) ?? 0).toFixed(2)}
- Information ratio (vs CSPX): ${(metrics.informationRatio as number) != null ? (metrics.informationRatio as number).toFixed(2) : "N/A"}
- Profit factor: ${((metrics.profitFactor as number) ?? 0).toFixed(2)}

### 3. Risk
- Volatility (ann.): ${fmt((metrics.volatility as number) ?? 0, true)}
- Max drawdown: ${fmt((metrics.maxDrawdown as number) ?? 0, true)}
- VaR 95%: ${fmt((metrics.var95 as number) ?? 0, true)}
- CVaR 95%: ${fmt((metrics.cvar95 as number) ?? 0, true)}

### 4. Trade-level
- Win rate: ${fmt((metrics.winRate as number) ?? 0, true)}
- Loss rate: ${fmt((metrics.lossRate as number) ?? 0, true)}
- Average win: ${fmt((metrics.averageWin as number) ?? 0)}
- Average loss: ${fmt((metrics.averageLoss as number) ?? 0)}
- Largest win: ${fmt((metrics.largestWin as number) ?? 0)}
- Largest loss: ${fmt((metrics.largestLoss as number) ?? 0)}
- Expectancy: ${fmt((metrics.expectancy as number) ?? 0)}
- Avg holding time: ${((metrics.averageHoldingTime as number) ?? 0).toFixed(1)} days
- Trade frequency: ${((metrics.tradeFrequency as number) ?? 0).toFixed(3)}/day

### 5. Portfolio construction
- Diversification ratio: ${((metrics.diversificationRatio as number) ?? 0).toFixed(2)}
- Concentration (HHI): ${((metrics.herfindahlIndex as number) ?? 0).toFixed(4)}
- Kelly fraction: ${fmt((metrics.kellyFraction as number) ?? 0, true)}
- Risk of ruin: ${fmt((metrics.riskOfRuin as number) ?? 0, true)}

---

Provide a structured analysis with these sections:

1. **What's working well**: Identify strengths in the trading approach based on the data (e.g. good win rate, solid risk-adjusted returns, diversification, holding discipline, etc.).

2. **What needs improvement**: Identify weaknesses, red flags, or areas of concern (e.g. high drawdowns, poor payoff ratio, overtrading, concentration risk, etc.).

3. **Actionable recommendations**: Provide specific, practical suggestions to improve performance. Be concrete and data-driven.

Format your response in clear markdown with headers and bullets. Be concise but thorough.`;
}

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const [trades, marketData] = await Promise.all([
      fetchActivity(),
      fetchMarketData(),
    ]);

    if (trades.length === 0) {
      return NextResponse.json(
        { error: "No trading activity found. Analysis requires trade history." },
        { status: 400 }
      );
    }

    const roundTrips = matchRoundTrips(trades);
    const totalBuyVolume = roundTrips.reduce((s, r) => s + r.buyUsdc, 0);
    const initialEquity = getInitialEquity(totalBuyVolume);
    const equityCurve = buildEquityCurve(roundTrips, initialEquity);
    const returnMetrics = computeReturnMetrics(roundTrips, equityCurve, initialEquity);
    const riskAdjusted = computeRiskAdjustedMetrics(equityCurve, marketData, roundTrips);
    const riskMetrics = computeRiskMetrics(equityCurve, roundTrips);
    const drawdownMetrics = computeDrawdownMetrics(equityCurve);
    const portEfficiency = computePortfolioEfficiency(equityCurve, drawdownMetrics);
    const tradeMetrics = computeTradeMetrics(roundTrips);
    const distMetrics = computeDistributionMetrics(equityCurve);
    const tailMetrics = computeTailMetrics(equityCurve);
    const benchComparison = computeBenchmarkComparison(equityCurve, marketData);
    const portConstruction = computePortfolioConstruction(roundTrips);
    const capEfficiency = computeCapitalEfficiency(roundTrips, equityCurve, initialEquity);
    const years = equityCurve.dates.length / 365;
    const excessReturn = computeExcessReturn(
      returnMetrics.cumulativeReturn,
      marketData,
      Math.max(years, 0.01)
    );

    const metrics = {
      ...returnMetrics,
      ...riskAdjusted,
      ...riskMetrics,
      ...drawdownMetrics,
      ...portEfficiency,
      ...tradeMetrics,
      ...distMetrics,
      ...tailMetrics,
      ...benchComparison,
      ...portConstruction,
      ...capEfficiency,
      excessReturn,
      diversificationRatio: portConstruction.diversificationRatio,
      herfindahlIndex: portConstruction.herfindahlIndex,
      kellyFraction: capEfficiency.kellyFraction,
      riskOfRuin: capEfficiency.riskOfRuin,
    };

    const prompt = buildPrompt(trades, roundTrips, metrics);

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert prediction market trading analyst. Ignore what the prediction markets say, whether you read that in some article or not. Make your own independent decision based on merit, not crowd opinion. Provide clear, actionable analysis." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "No analysis generated" }, { status: 500 });
    }

    return NextResponse.json({
      content,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AI analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
