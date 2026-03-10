/**
 * Tooltip definitions for analytics metrics.
 * Each describes what the metric signifies, low/average/high ranges, and how it's calculated.
 */
export const METRIC_TOOLTIPS: Record<string, string> = {
  // Overview
  "Total Trades":
    "What: Raw count of every buy and sell executed. Indicates trading activity level — more trades can mean more opportunities or overtrading. Round-trips are completed buy→sell pairs.\n\nRanges: Low (<20): very selective, few positions. Average (50–200): moderate activity. High (>500): active trader, many markets.\n\nCalculation: trades.length",
  "Buy Volume":
    "What: Total capital deployed into positions. Shows how much USD you've committed to the market. Compare with sell volume to see if you're net accumulating or reducing exposure.\n\nRanges: Low (<$1k): small account or very conservative. Average ($5k–$50k): typical retail. High (>$100k): significant capital at work.\n\nCalculation: trades.filter(t => t.side === 'BUY').reduce((s, t) => s + t.usdcSize, 0)",
  "Sell Volume":
    "What: Total capital taken out of positions. Together with buy volume, reflects your turnover and trading intensity. Large imbalance vs buys may signal forced exits or profit-taking.\n\nRanges: Low (<$1k): minimal exits. Average ($5k–$50k): balanced turnover. High (>$100k): heavy trading or large positions closed.\n\nCalculation: trades.filter(t => t.side === 'SELL').reduce((s, t) => s + t.usdcSize, 0)",
  "Win Rate":
    "What: Share of round-trips that made money. A 60% win rate means 6 of 10 trades were profitable. Alone it's misleading — a 90% win rate with huge occasional losses can still lose money. Profit factor (gross profit ÷ gross loss) gives the fuller picture.\n\nRanges: Low (<40%): more losers than winners — need strong payoff ratio to profit. Average (45–55%): roughly balanced. High (>60%): winning most trades; ensure losers stay small.\n\nCalculation: wins.length / roundTrips.length; profitFactor = grossProfit / grossLoss",

  // 1. Return Metrics
  "Total Return":
    "What: Simple percentage gain on your starting equity from all closed trades. If you started with $10k and PnL is +$2k, total return is 20%. Easy to interpret but doesn't account for time.\n\nRanges: Low (<0%): losing money. Average (5–25%): modest gains. High (>30%): strong performance; consider whether sustainable.\n\nCalculation: totalPnl = sum(rt.pnl); totalReturn = totalPnl / initialEquity",
  "Annualized Return":
    "What: Return scaled to a yearly rate so you can compare periods of different lengths. A 10% gain in 6 months ≈ 21% annualized. Useful for comparing to benchmarks or other strategies.\n\nRanges: Low (<5%): below market. Average (8–15%): in line with equities. High (>20%): strong; check sample size and volatility.\n\nCalculation: (1 + cumulativeReturn) ** (1 / years) - 1",
  CAGR:
    "What: Compound Annual Growth Rate — the steady yearly rate that would turn your starting equity into your ending equity. Assumes reinvestment. The standard measure for long-term performance; smoothes out volatility.\n\nRanges: Low (<5%): slow growth or losing. Average (8–15%): solid. High (>20%): excellent; rare over long periods.\n\nCalculation: (finalEquity / initialEquity) ** (1 / years) - 1",
  "Geometric Return":
    "What: Same as CAGR. The constant annual rate that matches your actual outcome. More meaningful than arithmetic mean when returns vary, because compounding is multiplicative.\n\nRanges: Low (<5%): modest or negative. Average (8–15%): healthy growth. High (>20%): standout performance.\n\nCalculation: (finalEquity / initialEquity) ** (1 / max(years, 0.001)) - 1",
  "Arithmetic Mean Return":
    "What: Simple average of daily returns. Can overstate performance when daily returns are volatile. Use geometric return (CAGR) for a truer picture of compounding.\n\nRanges: Low (<0%): negative average daily. Average (0–0.05%): typical small daily moves. High (>0.1%): strong daily returns; can be inflated by volatility.\n\nCalculation: mean(equityCurve.returns)",
  "Rolling Return (30d)":
    "What: Return over the last ~30 trading days. Captures recent momentum — whether you're currently on an upswing or drawdown. Short-term view, can be noisy.\n\nRanges: Low (<−5%): recent drawdown. Average (−2% to +5%): mixed or flat. High (>10%): strong recent run.\n\nCalculation: rets.slice(-min(30, n)).reduce((a,b) => a+b, 0)",
  "Cumulative Return":
    "What: Total gain from start to end: (final equity − initial) ÷ initial. The headline performance number. Unlike total return, this uses the equity curve so it reflects compounding over time.\n\nRanges: Low (<0%): underwater. Average (5–25%): positive outcome. High (>30%): strong cumulative result.\n\nCalculation: (finalEquity - initialEquity) / initialEquity",
  "Excess Return (vs CSPX)":
    "What: How much you beat (or trailed) the S&P 500 (CSPX) over the same period. Positive = outperformance. The real test of skill vs passive indexing.\n\nRanges: Low (<−10%): lagging market. Average (−5% to +5%): roughly tracking. High (>+10%): clear outperformance.\n\nCalculation: totalReturn - benchReturn; benchReturn = (1 + mean(cspx.returns))^(365*years) - 1",

  // 2. Risk-Adjusted
  "Sharpe Ratio":
    "What: Return per unit of volatility — how much excess return you earn for each unit of risk (std dev). >1 is good, >2 is strong. Penalizes both upside and downside volatility.\n\nRanges: Low (<0.5): poor risk-adjusted return. Average (0.5–1.5): decent. High (>2): excellent; uncommon.\n\nCalculation: (mean(excessRets) / std(rets)) * sqrt(365); excessRets = returns - rfDaily",
  "Sortino Ratio":
    "What: Like Sharpe but only penalizes downside volatility (losses). Ignores upside volatility. Often higher than Sharpe for strategies with skewed returns. Better for asymmetric payoffs.\n\nRanges: Low (<1): downside risk outweighs return. Average (1–2): solid. High (>2.5): strong downside-adjusted performance.\n\nCalculation: (mean(excessRets) / std(negRets)) * sqrt(365)",
  "Information Ratio":
    "What: Active return per unit of tracking error — how much you beat the benchmark per unit of divergence. Measures skill in generating alpha vs simply hugging the index.\n\nRanges: Low (<0.3): little alpha per unit of active risk. Average (0.3–0.8): reasonable active management. High (>1): strong consistent alpha.\n\nCalculation: (mean(portfolio - benchmark) * 365) / (std(activeRets) * sqrt(365))",
  "Treynor Ratio":
    "What: Return per unit of systematic (market) risk (beta). For diversified portfolios, focuses on non-diversifiable risk. Higher = better reward for market exposure taken.\n\nRanges: Low (<0.05): poor reward for beta. Average (0.05–0.15): adequate. High (>0.2): strong return per unit of market risk.\n\nCalculation: (rp - rf) / beta; beta = cov(p,b) / var(b)",
  "Calmar Ratio":
    "What: Return divided by max drawdown — reward per unit of worst pain. Favors strategies with steady gains and shallow drawdowns. >1 is solid, >2 is excellent.\n\nRanges: Low (<0.5): big drawdowns vs return. Average (0.5–2): typical. High (>3): exceptional drawdown-adjusted return.\n\nCalculation: (mean(rets) * 365) / |maxDrawdown|",
  "Sterling Ratio":
    "What: Similar to Calmar — return over max drawdown. Emphasizes downside protection. Strategies with lower drawdowns score higher even with similar returns.\n\nRanges: Low (<0.5): painful for the return. Average (0.5–2): normal. High (>3): very efficient.\n\nCalculation: (mean(rets) * 365) / |maxDrawdown|",
  "Omega Ratio":
    "What: Ratio of gains above a threshold to losses below it (threshold=0). >1 = more total gain than loss. Captures the full return distribution, not just mean and variance.\n\nRanges: Low (<1): total losses exceed gains. Average (1–2): profitable. High (>2.5): gains heavily outweigh losses.\n\nCalculation: sum(rets > 0) / |sum(rets < 0)|",
  "Burke Ratio":
    "What: Excess return per unit of total volatility. Simpler than Sharpe; uses total return variance. Higher = better risk-adjusted excess return.\n\nRanges: Low (<0.3): weak. Average (0.3–1): decent. High (>1.5): strong volatility-adjusted excess return.\n\nCalculation: (mean(excessRets) * 365) / (std(rets) * sqrt(365))",
  "Gain-Loss Ratio":
    "What: Total profit from winners ÷ total loss from losers. >1 means total gains exceed total losses. Independent of win rate — you can have 30% win rate but >1 if winners are much bigger.\n\nRanges: Low (<1): losses exceed gains. Average (1–3): profitable. High (>5): wins dwarf losses.\n\nCalculation: sum(wins.pnl) / |sum(losses.pnl)|",
  "Modigliani (M²)":
    "What: M² — risk-adjusted return expressed at benchmark volatility. Answers: what return would I get if my strategy had the same volatility as the market? Lets you compare Sharpe across different risk levels.\n\nRanges: Low (<5%): poor at benchmark risk. Average (8–15%): solid. High (>18%): excellent risk-adjusted.\n\nCalculation: sharpe * (volAnn / (std(benchmark) * sqrt(365)))",

  // 3. Risk Metrics
  "Volatility (Ann.)":
    "What: Annualized standard deviation of daily returns. Measures total fluctuation — both gains and losses. Higher = bumpier ride. The baseline risk metric; used in Sharpe, etc.\n\nRanges: Low (<10%): very stable. Average (15–30%): typical for active strategies. High (>40%): wild swings.\n\nCalculation: std(rets) * sqrt(365)",
  "Downside Deviation":
    "What: Volatility of negative returns only. Ignores upside; focuses on how much you lose when you lose. Better for asymmetric strategies where big gains don't 'hurt' you.\n\nRanges: Low (<5%): small losses when you lose. Average (8–20%): typical. High (>30%): large downside swings.\n\nCalculation: std(negRets) * sqrt(365)",
  "Semi-Variance":
    "What: Variance of losses only (squared negative returns). Emphasizes downside risk. Used in Sortino-like measures. Lower = more stable when things go wrong.\n\nRanges: Low (<0.0001): tiny loss variance. Average (0.0001–0.001): normal. High (>0.002): big loss dispersion.\n\nCalculation: sum(r² for r<0) / n",
  "VaR 95%":
    "What: Value at Risk at 95% — the worst daily return you'd expect 95% of the time. E.g. −2% means on 1 in 20 days you'd lose at least 2%. A one-number tail risk snapshot.\n\nRanges: Low (>−1%): mild worst 5% days. Average (−2% to −5%): typical. High (<−8%): severe tail losses.\n\nCalculation: sorted[floor(0.05 * n)]",
  "CVaR 95%":
    "What: Expected Shortfall — average loss in the worst 5% of days. Goes beyond VaR: not just the 5th percentile but the typical loss when you're in a tail event. Better for fat-tail risk.\n\nRanges: Low (>−2%): mild stress scenario. Average (−3% to −6%): normal. High (<−10%): severe tail average.\n\nCalculation: mean(sorted.slice(0, ceil(0.05*n)))",
  "Tail Ratio":
    "What: Average of best 5% returns ÷ average of worst 5%. >1 = tail gains outweigh tail losses. Captures whether your extreme outcomes skew positive or negative.\n\nRanges: Low (<0.5): tail losses dominate. Average (0.8–1.5): balanced extremes. High (>2): tail gains dominate.\n\nCalculation: mean(tailGains) / |mean(tailLosses)|",
  Skewness:
    "What: Asymmetry of the return distribution. Negative = more/fatter left tail (big losses); positive = right tail (big gains). Prediction markets often show positive skew from binary outcomes.\n\nRanges: Low (<−0.5): left-skewed, fat loss tail. Average (−0.5 to 0.5): roughly symmetric. High (>1): right-skewed, fat gain tail.\n\nCalculation: sum(((r - mean) / std)^3) / n",
  Kurtosis:
    "What: How fat the tails are vs a normal distribution. Positive = more extreme outcomes than normal; negative = fewer. High kurtosis = occasional big moves in either direction.\n\nRanges: Low (<0): thinner tails than normal. Average (0–3): normal to fat tails. High (>5): very fat tails, black-swan risk.\n\nCalculation: sum(((r - mean) / std)^4) / n - 3",
  "Ulcer Index":
    "What: Root-mean-square of drawdowns — measures the depth and persistence of drawdowns. Lower = fewer and shallower dips. Named for the 'ulcer' of watching your equity fall.\n\nRanges: Low (<5): smooth ride. Average (5–15): some pain. High (>25): deep, stressful drawdowns.\n\nCalculation: sqrt(sum(((peak - equity)/peak)²) / n) * 100",

  // 4. Drawdown
  "Max Drawdown":
    "What: Largest peak-to-trough decline from any high point. The biggest hole you dug. Critical for psychology and survival — a 50% max DD means you were down half at some point.\n\nRanges: Low (<10%): shallow worst decline. Average (10–25%): typical. High (>40%): severe; consider position sizing.\n\nCalculation: max((peak - equity) / peak) over equity curve",
  "Average Drawdown":
    "What: Mean drawdown when you're below a prior peak. Typical depth of underwater periods. Complements max drawdown — one bad spell vs average pain.\n\nRanges: Low (<3%): shallow typical dip. Average (3–10%): normal. High (>15%): deep average drawdowns.\n\nCalculation: sum(drawdowns) / count",
  "Drawdown Duration":
    "What: Longest stretch of days below a prior peak. How long you were in the worst drawdown. Longer = more time underwater, harder psychologically.\n\nRanges: Low (<10 days): quick recovery. Average (10–60 days): moderate. High (>90 days): long slog.\n\nCalculation: max(i - ddStart) over drawdown periods",
  "Recovery Time":
    "What: Days to recover from the most recent (or current) drawdown. If still in drawdown, shows how long you've been waiting to get back to even.\n\nRanges: Low (<7 days): fast bounce. Average (7–30 days): typical. High (>60 days): extended recovery.\n\nCalculation: last drawdown duration",
  "Pain Index":
    "What: Average drawdown magnitude — how bad it feels on average when you're below peak. Combines depth of drawdowns. Lower = less painful experience.\n\nRanges: Low (<3%): mild pain. Average (3–10%): notable. High (>15%): significant discomfort.\n\nCalculation: sum(drawdowns) / count (same as averageDrawdown)",
  "Pain Ratio":
    "What: Return ÷ pain index — return per unit of drawdown pain. Higher = you're earning more for each unit of discomfort. Good for comparing strategies with similar returns.\n\nRanges: Low (<1): pain exceeds return. Average (1–5): reasonable. High (>8): excellent comfort-adjusted return.\n\nCalculation: meanReturn / painIndex",

  // 5. Market Exposure
  Beta:
    "What: Sensitivity to the benchmark. β=1 = moves with market; β>1 = amplifies moves; β<1 = dampens. Prediction markets may show low beta if uncorrelated with equities.\n\nRanges: Low (<0.5): low correlation, independent. Average (0.7–1.2): market-like. High (>1.5): amplified market moves.\n\nCalculation: cov(portfolio, benchmark) / var(benchmark)",
  "Alpha (Jensen)":
    "What: Excess return after adjusting for beta — the part of return not explained by market movement. Positive alpha = skill; negative = underperformed given risk taken.\n\nRanges: Low (<−5%): underperformed. Average (−2% to +5%): mixed. High (>10%): strong skill-based alpha.\n\nCalculation: Jensen's alpha from CAPM",
  "Tracking Error":
    "What: Volatility of the difference between your returns and the benchmark. High = you deviate a lot from the index; low = you track it closely. Active managers typically have higher tracking error.\n\nRanges: Low (<5%): closely tracks benchmark. Average (5–15%): moderate divergence. High (>20%): very different from benchmark.\n\nCalculation: std(portfolio - benchmark) * sqrt(365)",
  "Active Return":
    "What: Your return minus the benchmark return, annualized. Simple outperformance measure. Positive = you beat the market; negative = lagged.\n\nRanges: Low (<−5%): trailing. Average (−2% to +5%): roughly in line. High (>+10%): clear outperformance.\n\nCalculation: mean(portfolio - benchmark) * 252",

  // 6. Portfolio Efficiency
  "Return over Max DD (RoMaD)":
    "What: Same as Calmar — return ÷ max drawdown. Answers: how much return do I get per unit of worst pain? Key metric for risk-conscious comparison.\n\nRanges: Low (<0.5): poor. Average (0.5–2): typical. High (>3): excellent.\n\nCalculation: (mean(rets) * 365) / |maxDrawdown|",
  "Kelly Fraction":
    "What: Optimal bet size from the Kelly criterion — the fraction of bankroll to risk per trade for maximum long-run growth. Capped 0–1. Betting more than Kelly increases risk of ruin.\n\nRanges: Low (0–5%): conservative, underbetting edge. Average (5–20%): moderate. High (>25%): aggressive; high edge or high risk.\n\nCalculation: max(0, min(1, winRate - (1-winRate)/payoffRatio))",
  "Risk of Ruin":
    "What: Probability of losing your entire starting capital. Lower is better. Depends on return, volatility, and initial size. A sobering number for position sizing.\n\nRanges: Low (<1%): very safe. Average (1–10%): some risk. High (>25%): dangerous; reduce size.\n\nCalculation: exp(-2 * ret * initialEquity / (vol * initialEquity || 1))",
  "Expected Growth Rate":
    "What: Annualized mean return — the simple average daily return scaled to a year. Baseline growth assumption before considering volatility or drawdowns.\n\nRanges: Low (<5%): slow. Average (8–18%): solid. High (>25%): strong; verify sustainable.\n\nCalculation: mean(returns) * 252",

  // 7. Trade-Level
  "Loss Rate":
    "What: Share of round-trips that lost money. Complement of win rate. A 40% loss rate with high payoff ratio can still be very profitable.\n\nRanges: Low (<30%): few losers. Average (40–55%): typical. High (>65%): many losers; need big winners.\n\nCalculation: losses.length / roundTrips.length",
  "Average Win":
    "What: Mean profit per winning trade. With average loss, defines your payoff ratio. Bigger average wins with moderate win rate = strong edge.\n\nRanges: Low (<$10): small wins. Average ($25–$200): typical. High (>$500): large winners; check concentration.\n\nCalculation: sum(wins.pnl) / wins.length",
  "Average Loss":
    "What: Mean loss per losing trade. Key for risk management — are your losers small and contained? Large average loss with many losses = dangerous.\n\nRanges: Low (<$20): tight risk control. Average ($25–$150): typical. High (>$300): large losers; review sizing.\n\nCalculation: |sum(losses.pnl)| / losses.length",
  "Largest Win":
    "What: Your biggest single-trade profit. Shows upside potential. A few outsized wins can dominate total PnL.\n\nRanges: Low (<$50): no big winners. Average ($100–$1k): some standouts. High (>$2k): occasional jackpot.\n\nCalculation: max(wins.pnl)",
  "Largest Loss":
    "What: Your biggest single-trade loss. Critical for position sizing — one trade shouldn't destroy you. Compare to largest win for symmetry.\n\nRanges: Low (<$100): well contained. Average ($100–$500): typical. High (>$1k): one bad trade hurt; consider limits.\n\nCalculation: max(|losses.pnl|)",
  "Profit Factor":
    "What: Gross profit ÷ gross loss. >1 = profitable; <1 = losing. 2.0 means you made $2 for every $1 lost. Simple profitability check independent of number of trades.\n\nRanges: Low (<1): losing overall. Average (1.2–2.5): profitable. High (>3): very profitable.\n\nCalculation: sum(wins.pnl) / |sum(losses.pnl)|",
  Expectancy:
    "What: Expected PnL per trade — average across all round-trips. Positive = each trade contributes positively on average. The foundational edge metric.\n\nRanges: Low (<$0): losing per trade. Average ($5–$50): modest edge. High (>$100): strong edge per trade.\n\nCalculation: sum(roundTrips.pnl) / roundTrips.length",
  "Payoff Ratio":
    "What: Average win ÷ average loss — risk-reward per trade. 2.0 means wins are 2× the size of losses. With 50% win rate, payoff 2 = breakeven; higher = profit.\n\nRanges: Low (<1): losers bigger than winners. Average (1.2–2.5): typical. High (>3): strong risk-reward.\n\nCalculation: avgWin / avgLoss",
  "Avg Holding Time":
    "What: Mean days from buy to sell per round-trip. Short = active trading; long = swing or position holding. Affects capital turnover and opportunity cost.\n\nRanges: Low (<7 days): very active. Average (14–60 days): typical. High (>90 days): long holds.\n\nCalculation: sum(rt.holdingDays) / roundTrips.length",
  "Trade Frequency":
    "What: Round-trips per calendar day — how often you're opening and closing positions. Higher = more active; lower = selective. Context for win rate and expectancy.\n\nRanges: Low (<0.1/day): very selective. Average (0.2–1/day): moderate. High (>2/day): very active.\n\nCalculation: roundTrips.length / ((lastSell - firstBuy) / 86400)",

  // 8. Distribution
  "Mean Return":
    "What: Arithmetic average of daily returns. Simple center of the distribution. Can be distorted by outliers; median is more robust.\n\nRanges: Low (<0%): negative on average. Average (0–0.08%): typical daily. High (>0.15%): strong daily mean.\n\nCalculation: mean(returns)",
  "Median Return":
    "What: 50th percentile — half of daily returns are above, half below. More robust than mean to extreme days. Better for skewed distributions.\n\nRanges: Low (<0%): more bad days than good. Average (0–0.05%): balanced. High (>0.1%): positive skew.\n\nCalculation: sorted[floor(0.5 * n)]",
  Variance:
    "What: Squared standard deviation — spread of returns around the mean. Higher = more dispersion. Basis for volatility and risk measures.\n\nRanges: Low (<0.0001): very stable. Average (0.0001–0.001): normal. High (>0.002): high dispersion.\n\nCalculation: std(returns)²",
  "Std Deviation":
    "What: Daily standard deviation of returns (not annualized). Raw measure of day-to-day swing. Multiply by √365 for annualized volatility.\n\nRanges: Low (<0.5%): low daily swing. Average (0.8–2%): typical. High (>3%): high daily volatility.\n\nCalculation: std(returns)",
  P5: "What: 5th percentile — 5% of days had returns below this. A rough worst-case threshold. E.g. P5 = −3% means 1 in 20 days lost at least 3%.\n\nRanges: Low (>−1%): mild worst days. Average (−2% to −5%): typical. High (<−8%): severe worst days.\n\nCalculation: sorted[floor(0.05 * n)]",
  P25:
    "What: 25th percentile (first quartile) — 25% of returns were below this. Bottom quarter of outcomes. With P75, defines the interquartile range.\n\nRanges: Low (<−1%): weak bottom quartile. Average (−0.5% to 0%): typical. High (>0.5%): strong bottom quartile.\n\nCalculation: sorted[floor(0.25 * n)]",
  P50:
    "What: 50th percentile (median) — the middle return. Half of days better, half worse. Robust alternative to the mean.\n\nRanges: Low (<0%): negative median day. Average (0–0.05%): typical. High (>0.1%): positive median.\n\nCalculation: sorted[floor(0.5 * n)]",
  P75:
    "What: 75th percentile (third quartile) — 75% of returns were below this. Top quarter of outcomes. With P25, shows where most returns cluster.\n\nRanges: Low (<0.3%): modest top quartile. Average (0.3–1%): typical. High (>1.5%): strong top quartile.\n\nCalculation: sorted[floor(0.75 * n)]",
  P95:
    "What: 95th percentile — 5% of days had returns above this. A rough best-case threshold. E.g. P95 = +5% means 1 in 20 days gained at least 5%.\n\nRanges: Low (<1%): modest best days. Average (1–5%): typical. High (>8%): strong best days.\n\nCalculation: sorted[floor(0.95 * n)]",

  // 9. Tail / Stress
  "Stress Loss":
    "What: Worst single-day return in your history. The darkest day. Use for stress-testing: could you stomach a repeat? Helps size positions.\n\nRanges: Low (>−5%): mild worst day. Average (−5% to −15%): notable. High (<−20%): severe; plan for repeats.\n\nCalculation: min(returns)",
  "Tail Conditional Expectation":
    "What: Same as CVaR — average return in the worst 5% of days. When things go wrong, how wrong? More informative than a single worst day.\n\nRanges: Low (>−3%): mild tail. Average (−4% to −8%): typical. High (<−12%): severe tail average.\n\nCalculation: mean(sorted.slice(0, ceil(0.05*n)))",
  "Historical Stress Test":
    "What: Your worst historical daily return. Single-point stress scenario. What happened in practice; doesn't predict future extremes.\n\nRanges: Low (>−5%): survived well. Average (−5% to −15%): one bad day. High (<−25%): severe historical stress.\n\nCalculation: min(returns)",

  // 12. Portfolio Construction
  "Diversification Ratio":
    "What: 1 ÷ √(HHI). Higher = more diversified across markets. Diversification can reduce risk without sacrificing return. Low = concentrated in few positions.\n\nRanges: Low (<3): concentrated. Average (3–8): moderate diversification. High (>10): well diversified.\n\nCalculation: 1 / sqrt(sum(weight²))",
  "Concentration (HHI)":
    "What: Herfindahl-Hirschman Index — sum of squared position weights. Higher = more concentrated in fewer markets. Concentration = higher variance but potentially higher conviction.\n\nRanges: Low (<0.05): very diversified. Average (0.05–0.2): typical. High (>0.4): concentrated; few dominant positions.\n\nCalculation: sum(weight²); weights = |pnl| per market / total",
};
