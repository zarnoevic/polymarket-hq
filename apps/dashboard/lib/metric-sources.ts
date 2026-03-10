/**
 * External reference URLs for analytics metrics.
 * Prefer Wikipedia or Investopedia; use other authoritative sources when neither has a direct match.
 */
export const METRIC_SOURCES: Record<string, string> = {
  // Overview
  "Total Trades":
    "https://www.investopedia.com/terms/t/trade.asp",
  "Buy Volume":
    "https://www.investopedia.com/terms/v/volume.asp",
  "Sell Volume":
    "https://www.investopedia.com/terms/v/volume.asp",
  "Win Rate":
    "https://www.investopedia.com/terms/w/win-loss-ratio.asp",

  // 1. Return Metrics
  "Total Return":
    "https://www.investopedia.com/terms/t/totalreturn.asp",
  "Annualized Return":
    "https://www.investopedia.com/terms/a/annualized-total-return.asp",
  CAGR:
    "https://www.investopedia.com/terms/c/cagr.asp",
  "Geometric Return":
    "https://en.wikipedia.org/wiki/Geometric_mean",
  "Arithmetic Mean Return":
    "https://en.wikipedia.org/wiki/Arithmetic_mean",
  "Rolling Return (30d)":
    "https://www.investopedia.com/terms/t/totalreturn.asp",
  "Cumulative Return":
    "https://www.investopedia.com/terms/c/cumulativereturn.asp",
  "Excess Return (vs CSPX)":
    "https://www.investopedia.com/terms/e/excessreturn.asp",

  // 2. Risk-Adjusted
  "Sharpe Ratio":
    "https://www.investopedia.com/terms/s/sharperatio.asp",
  "Sortino Ratio":
    "https://www.investopedia.com/terms/s/sortinoratio.asp",
  "Information Ratio":
    "https://www.investopedia.com/terms/i/informationratio.asp",
  "Treynor Ratio":
    "https://www.investopedia.com/terms/t/treynorratio.asp",
  "Calmar Ratio":
    "https://www.investopedia.com/terms/c/calmarratio.asp",
  "Sterling Ratio":
    "https://en.wikipedia.org/wiki/Sterling_ratio",
  "Omega Ratio":
    "https://en.wikipedia.org/wiki/Omega_ratio",
  "Burke Ratio":
    "https://breakingdownfinance.com/finance-topics/performance-measurement/burke-ratio",
  "Gain-Loss Ratio":
    "https://www.investopedia.com/terms/p/profit_loss_ratio.asp",
  "Modigliani (M²)":
    "https://en.wikipedia.org/wiki/Modigliani_risk-adjusted_performance",

  // 3. Risk Metrics
  "Volatility (Ann.)":
    "https://www.investopedia.com/terms/v/volatility.asp",
  "Downside Deviation":
    "https://www.investopedia.com/terms/d/downside-deviation.asp",
  "Semi-Variance":
    "https://en.wikipedia.org/wiki/Semivariance",
  "VaR 95%":
    "https://www.investopedia.com/terms/v/var.asp",
  "CVaR 95%":
    "https://en.wikipedia.org/wiki/Expected_shortfall",
  "Tail Ratio":
    "https://www.investopedia.com/terms/s/sortinoratio.asp",
  Skewness:
    "https://en.wikipedia.org/wiki/Skewness",
  Kurtosis:
    "https://en.wikipedia.org/wiki/Kurtosis",
  "Ulcer Index":
    "https://en.wikipedia.org/wiki/Ulcer_index",

  // 4. Drawdown
  "Max Drawdown":
    "https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp",
  "Average Drawdown":
    "https://www.investopedia.com/terms/d/drawdown.asp",
  "Drawdown Duration":
    "https://www.investopedia.com/terms/d/drawdown.asp",
  "Recovery Time":
    "https://www.investopedia.com/terms/d/drawdown.asp",
  "Pain Index":
    "https://en.wikipedia.org/wiki/Ulcer_index",
  "Pain Ratio":
    "https://en.wikipedia.org/wiki/Ulcer_index",

  // 5. Market Exposure
  Beta:
    "https://www.investopedia.com/terms/b/beta.asp",
  "Alpha (Jensen)":
    "https://www.investopedia.com/terms/a/alpha.asp",
  "Tracking Error":
    "https://www.investopedia.com/terms/t/trackingerror.asp",
  "Active Return":
    "https://www.investopedia.com/terms/e/excessreturn.asp",

  // 6. Portfolio Efficiency
  "Return over Max DD (RoMaD)":
    "https://www.investopedia.com/terms/c/calmarratio.asp",
  "Kelly Fraction":
    "https://en.wikipedia.org/wiki/Kelly_criterion",
  "Risk of Ruin":
    "https://en.wikipedia.org/wiki/Risk_of_ruin",
  "Expected Growth Rate":
    "https://www.investopedia.com/terms/c/cagr.asp",

  // 7. Trade-Level
  "Loss Rate":
    "https://www.investopedia.com/terms/w/win-loss-ratio.asp",
  "Average Win":
    "https://www.investopedia.com/terms/p/profit.asp",
  "Average Loss":
    "https://www.investopedia.com/terms/l/loss.asp",
  "Largest Win":
    "https://www.investopedia.com/terms/p/profit.asp",
  "Largest Loss":
    "https://www.investopedia.com/terms/l/loss.asp",
  "Profit Factor":
    "https://www.investopedia.com/terms/p/profit_loss_ratio.asp",
  Expectancy:
    "https://www.investopedia.com/terms/p/profit_loss_ratio.asp",
  "Payoff Ratio":
    "https://www.investopedia.com/terms/r/riskrewardratio.asp",
  "Avg Holding Time":
    "https://www.investopedia.com/terms/h/holdingperiod.asp",
  "Trade Frequency":
    "https://www.investopedia.com/terms/t/trade.asp",

  // 8. Distribution
  "Mean Return":
    "https://en.wikipedia.org/wiki/Arithmetic_mean",
  "Median Return":
    "https://en.wikipedia.org/wiki/Median",
  Variance:
    "https://en.wikipedia.org/wiki/Variance",
  "Std Deviation":
    "https://en.wikipedia.org/wiki/Standard_deviation",
  P5: "https://en.wikipedia.org/wiki/Percentile",
  P25: "https://en.wikipedia.org/wiki/Percentile",
  P50: "https://en.wikipedia.org/wiki/Percentile",
  P75: "https://en.wikipedia.org/wiki/Percentile",
  P95: "https://en.wikipedia.org/wiki/Percentile",

  // 9. Tail / Stress
  "Stress Loss":
    "https://www.investopedia.com/terms/s/stresstesting.asp",
  "Tail Conditional Expectation":
    "https://en.wikipedia.org/wiki/Expected_shortfall",
  "Historical Stress Test":
    "https://www.investopedia.com/terms/s/stresstesting.asp",

  // 12. Portfolio Construction
  "Diversification Ratio":
    "https://www.investopedia.com/terms/d/diversification.asp",
  "Concentration (HHI)":
    "https://en.wikipedia.org/wiki/Herfindahl%E2%80%93Hirschman_index",
};
