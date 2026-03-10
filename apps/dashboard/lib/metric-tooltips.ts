/**
 * Tooltip definitions for analytics metrics.
 * Each describes what the metric means and how it's calculated in lib/metrics.ts
 */
export const METRIC_TOOLTIPS: Record<string, string> = {
  // Overview
  "Total Trades":
    "What: Count of all individual buy/sell transactions from the activity API.\n\nCalculation: trades.length",
  "Buy Volume":
    "What: Total USD value of all BUY orders.\n\nCalculation: trades.filter(t => t.side === 'BUY').reduce((s, t) => s + t.usdcSize, 0)",
  "Sell Volume":
    "What: Total USD value of all SELL orders.\n\nCalculation: trades.filter(t => t.side === 'SELL').reduce((s, t) => s + t.usdcSize, 0)",
  "Win Rate":
    "What: Percentage of round-trips that made a profit. Profit factor = gross profit / gross loss.\n\nCalculation: wins.length / roundTrips.length; profitFactor = grossProfit / grossLoss",

  // 1. Return Metrics
  "Total Return":
    "What: Simple return from initial equity: (final equity - initial) / initial. PnL is sum of all round-trip profits.\n\nCalculation: totalPnl = sum(rt.pnl); totalReturn = totalPnl / initialEquity",
  "Annualized Return":
    "What: Return normalized to a yearly rate: (1 + cumulativeReturn)^(1/years) - 1.\n\nCalculation: (1 + cumulativeReturn) ** (1 / years) - 1",
  CAGR:
    "What: Compound Annual Growth Rate — geometric return assuming reinvestment. Same as geometric return.\n\nCalculation: (finalEquity / initialEquity) ** (1 / years) - 1",
  "Geometric Return":
    "What: CAGR — the constant annual rate that would grow initial to final equity.\n\nCalculation: (finalEquity / initialEquity) ** (1 / max(years, 0.001)) - 1",
  "Arithmetic Mean Return":
    "What: Average of daily returns (simple mean).\n\nCalculation: mean(equityCurve.returns)",
  "Rolling Return (30d)":
    "What: Sum of returns over the last ~30 trading days (or fewer if less data).\n\nCalculation: rets.slice(-min(30, n)).reduce((a,b) => a+b, 0)",
  "Cumulative Return":
    "What: Total return over the period: (final equity - initial equity) / initial equity.\n\nCalculation: (finalEquity - initialEquity) / initialEquity",
  "Excess Return (vs CSPX)":
    "What: Portfolio cumulative return minus benchmark (CSPX) return over the same period.\n\nCalculation: totalReturn - benchReturn; benchReturn = (1 + mean(cspx.returns))^(252*years) - 1",

  // 2. Risk-Adjusted
  "Sharpe Ratio":
    "What: Excess return per unit of volatility (annualized). Higher is better.\n\nCalculation: (mean(excessRets) / std(rets)) * sqrt(252); excessRets = returns - rfDaily",
  "Sortino Ratio":
    "What: Like Sharpe but uses downside deviation (volatility of negative returns only).\n\nCalculation: (mean(excessRets) / std(negRets)) * sqrt(252)",
  "Information Ratio":
    "What: Active return per unit of tracking error vs benchmark.\n\nCalculation: (mean(portfolio - benchmark) * 252) / (std(activeRets) * sqrt(252))",
  "Treynor Ratio":
    "What: Excess return per unit of systematic risk (beta).\n\nCalculation: (rp - rf) / beta; beta = cov(p,b) / var(b)",
  "Calmar Ratio":
    "What: Annualized return divided by absolute max drawdown.\n\nCalculation: (mean(rets) * 252) / |maxDrawdown|",
  "Sterling Ratio":
    "What: Similar to Calmar — return over max drawdown.\n\nCalculation: (mean(rets) * 252) / |maxDrawdown|",
  "Omega Ratio":
    "What: Sum of gains above threshold / sum of losses below threshold. Threshold = 0.\n\nCalculation: sum(rets > 0) / |sum(rets < 0)|",
  "Burke Ratio":
    "What: Excess return divided by annualized volatility.\n\nCalculation: (mean(excessRets) * 252) / (std(rets) * sqrt(252))",
  "Gain-Loss Ratio":
    "What: Total profit from winning trades / total loss from losing trades.\n\nCalculation: sum(wins.pnl) / |sum(losses.pnl)|",
  "Modigliani (M²)":
    "What: M-squared — risk-adjusted return scaled to benchmark volatility. sharpe * (volAnn / volBenchmark).\n\nCalculation: sharpe * (volAnn / (std(benchmark) * sqrt(252)))",

  // 3. Risk Metrics
  "Volatility (Ann.)":
    "What: Annualized standard deviation of daily returns.\n\nCalculation: std(rets) * sqrt(252)",
  "Downside Deviation":
    "What: Volatility of negative returns only, annualized.\n\nCalculation: std(negRets) * sqrt(252/365)",
  "Semi-Variance":
    "What: Variance of negative returns only (squared deviations for r < 0).\n\nCalculation: sum(r² for r<0) / n",
  "VaR 95%":
    "What: Value at Risk — 5th percentile of return distribution (worst 5% outcome).\n\nCalculation: sorted[floor(0.05 * n)]",
  "CVaR 95%":
    "What: Conditional VaR / Expected Shortfall — average of worst 5% of returns.\n\nCalculation: mean(sorted.slice(0, ceil(0.05*n)))",
  "Tail Ratio":
    "What: Average of best 5% returns / average of worst 5% returns (in absolute value).\n\nCalculation: mean(tailGains) / |mean(tailLosses)|",
  Skewness:
    "What: Asymmetry of return distribution. Negative = left tail heavier.\n\nCalculation: sum(((r - mean) / std)^3) / n",
  Kurtosis:
    "What: Tail heaviness vs normal. Excess kurtosis (minus 3).\n\nCalculation: sum(((r - mean) / std)^4) / n - 3",
  "Ulcer Index":
    "What: RMS of drawdowns from running peak. Measures drawdown pain.\n\nCalculation: sqrt(sum(((peak - equity)/peak)²) / n) * 100",

  // 4. Drawdown
  "Max Drawdown":
    "What: Largest peak-to-trough decline as a fraction of peak. Shown as negative.\n\nCalculation: max((peak - equity) / peak) over equity curve",
  "Average Drawdown":
    "What: Mean of all drawdown values when equity is below peak.\n\nCalculation: sum(drawdowns) / count",
  "Drawdown Duration":
    "What: Longest number of days in a continuous drawdown period.\n\nCalculation: max(i - ddStart) over drawdown periods",
  "Recovery Time":
    "What: Days to recover from last drawdown (or current if still in drawdown).\n\nCalculation: last drawdown duration",
  "Pain Index":
    "What: Average drawdown magnitude when in drawdown.\n\nCalculation: sum(drawdowns) / count (same as averageDrawdown)",
  "Pain Ratio":
    "What: Mean return divided by pain index (return per unit of pain).\n\nCalculation: meanReturn / painIndex",

  // 5. Market Exposure
  Beta:
    "What: Sensitivity to benchmark. Portfolio covariance with benchmark / benchmark variance.\n\nCalculation: cov(portfolio, benchmark) / var(benchmark)",
  "Alpha (Jensen)":
    "What: Excess return after accounting for beta. rp - (rf + beta * (rb - rf)).\n\nCalculation: Jensen's alpha from CAPM",
  "Tracking Error":
    "What: Volatility of active returns (portfolio - benchmark).\n\nCalculation: std(portfolio - benchmark) * sqrt(252)",
  "Active Return":
    "What: Average difference between portfolio and benchmark returns, annualized.\n\nCalculation: mean(portfolio - benchmark) * 252",

  // 6. Portfolio Efficiency
  "Return over Max DD (RoMaD)":
    "What: Annualized return divided by absolute max drawdown. Same as Calmar.\n\nCalculation: (mean(rets) * 252) / |maxDrawdown|",
  "Kelly Fraction":
    "What: Optimal bet size from Kelly criterion. winRate - (1 - winRate) / payoff, capped [0,1].\n\nCalculation: max(0, min(1, winRate - (1-winRate)/payoffRatio))",
  "Risk of Ruin":
    "What: Probability of losing initial capital. Uses volatility and annualized return.\n\nCalculation: exp(-2 * ret * initialEquity / (vol * initialEquity || 1))",
  "Expected Growth Rate":
    "What: Annualized mean return (simple).\n\nCalculation: mean(returns) * 252",

  // 7. Trade-Level
  "Loss Rate":
    "What: Fraction of round-trips with non-positive PnL.\n\nCalculation: losses.length / roundTrips.length",
  "Average Win":
    "What: Mean profit per winning round-trip.\n\nCalculation: sum(wins.pnl) / wins.length",
  "Average Loss":
    "What: Mean loss per losing round-trip (absolute value).\n\nCalculation: |sum(losses.pnl)| / losses.length",
  "Largest Win":
    "What: Maximum single-trade profit.\n\nCalculation: max(wins.pnl)",
  "Largest Loss":
    "What: Maximum single-trade loss (absolute).\n\nCalculation: max(|losses.pnl|)",
  "Profit Factor":
    "What: Gross profit / gross loss. >1 means profitable.\n\nCalculation: sum(wins.pnl) / |sum(losses.pnl)|",
  Expectancy:
    "What: Expected PnL per trade (average across all round-trips).\n\nCalculation: sum(roundTrips.pnl) / roundTrips.length",
  "Payoff Ratio":
    "What: Average win / average loss (risk-reward per trade).\n\nCalculation: avgWin / avgLoss",
  "Avg Holding Time":
    "What: Mean days between buy and sell per round-trip.\n\nCalculation: sum(rt.holdingDays) / roundTrips.length",
  "Trade Frequency":
    "What: Round-trips per calendar day over the trading period.\n\nCalculation: roundTrips.length / ((lastSell - firstBuy) / 86400)",

  // 8. Distribution
  "Mean Return":
    "What: Arithmetic mean of daily returns.\n\nCalculation: mean(returns)",
  "Median Return":
    "What: 50th percentile (P50) of return distribution.\n\nCalculation: sorted[floor(0.5 * n)]",
  Variance:
    "What: Squared standard deviation of returns.\n\nCalculation: std(returns)²",
  "Std Deviation":
    "What: Standard deviation of daily returns (not annualized).\n\nCalculation: std(returns)",
  P5: "What: 5th percentile — 5% of returns are below this.\n\nCalculation: sorted[floor(0.05 * n)]",
  P25:
    "What: 25th percentile (first quartile).\n\nCalculation: sorted[floor(0.25 * n)]",
  P50:
    "What: 50th percentile (median).\n\nCalculation: sorted[floor(0.5 * n)]",
  P75:
    "What: 75th percentile (third quartile).\n\nCalculation: sorted[floor(0.75 * n)]",
  P95:
    "What: 95th percentile — 5% of returns are above this.\n\nCalculation: sorted[floor(0.95 * n)]",

  // 9. Tail / Stress
  "Stress Loss":
    "What: Worst single-day return in the history.\n\nCalculation: min(returns)",
  "Tail Conditional Expectation":
    "What: Same as CVaR — average of worst 5% of returns.\n\nCalculation: mean(sorted.slice(0, ceil(0.05*n)))",
  "Historical Stress Test":
    "What: Same as stress loss — worst historical return.\n\nCalculation: min(returns)",

  // 12. Portfolio Construction
  "Diversification Ratio":
    "What: 1 / sqrt(HHI). Higher = more diversified.\n\nCalculation: 1 / sqrt(sum(weight²))",
  "Concentration (HHI)":
    "What: Herfindahl-Hirschman Index — sum of squared position weights. Higher = more concentrated.\n\nCalculation: sum(weight²); weights = |pnl| per market / total",
};
