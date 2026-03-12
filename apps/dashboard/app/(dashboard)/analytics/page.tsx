import {
  fetchActivity,
  getInitialEquity,
} from "../../../lib/polymarket";
import { fetchMarketData } from "../../../lib/benchmark";
import { matchRoundTrips } from "../../../lib/round-trip";
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
  computeLiquidityMetrics,
  computeBenchmarkComparison,
  computePortfolioConstruction,
  computeCapitalEfficiency,
  computeExcessReturn,
} from "../../../lib/metrics";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ExternalLink,
  Layers,
  TrendingUp,
  Zap,
  Shield,
  Target,
  Percent,
  AlertTriangle,
  PieChart,
  Gauge,
} from "lucide-react";
import { METRIC_TOOLTIPS } from "../../../lib/metric-tooltips";
import { METRIC_SOURCES } from "../../../lib/metric-sources";
import { MetricTooltip } from "../../components/MetricTooltip";

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Compact format for USD: $1K, $100K, $1M for large values */
function formatCompactUsd(value: number, decimals = 0): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return formatUsd(value, decimals);
}

function formatUsdOrCompact(value: number, decimals = 0): string {
  return Math.abs(value) >= 1_000 ? formatCompactUsd(value, 0) : formatUsd(value, decimals);
}

function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Return as multiplier: 0.5 -> 1.5x, -0.25 -> 0.75x */
function formatReturnAsX(value: number, decimals = 2): string {
  const x = 1 + value;
  return `${x.toFixed(decimals)}x`;
}

function formatNum(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  variant = "default",
  tooltipKey,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "positive" | "negative";
  tooltipKey?: string;
}) {
  const color =
    variant === "positive"
      ? "bg-emerald-500/20 text-emerald-400"
      : variant === "negative"
        ? "bg-rose-500/20 text-rose-400"
        : "bg-indigo-500/20 text-indigo-400";
  const tooltip = tooltipKey ? METRIC_TOOLTIPS[tooltipKey] : undefined;
  const sourceUrl = tooltipKey ? METRIC_SOURCES[tooltipKey] : undefined;
  const titleEl = sourceUrl ? (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-slate-500 transition-colors hover:text-indigo-400 hover:underline"
    >
      <span className="truncate">{title}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  ) : (
    <span className="truncate">{title}</span>
  );
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500">
            {titleEl}
            {tooltip && <MetricTooltip content={tooltip} />}
          </div>
          <p className="truncate font-semibold text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function MetricSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50">
      <div className="border-b border-slate-700/50 px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Icon className="h-5 w-5 text-indigo-400" />
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  const [trades, marketData] = await Promise.all([
    fetchActivity(),
    fetchMarketData(),
  ]);

  const roundTrips = matchRoundTrips(trades);
  const totalPositionsHeld = new Set(trades.map((t) => t.asset)).size;
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
  const liquidityMetrics = computeLiquidityMetrics();
  const benchComparison = computeBenchmarkComparison(equityCurve, marketData);
  const portConstruction = computePortfolioConstruction(roundTrips);
  const capEfficiency = computeCapitalEfficiency(roundTrips, equityCurve, initialEquity);

  const years = equityCurve.dates.length / 365;
  const excessReturn = computeExcessReturn(returnMetrics.cumulativeReturn, marketData, Math.max(years, 0.01));
  const riskFreePct = marketData.riskFreeRateAnnual * 100;

  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-4 pb-12">
        {trades.length > 0 ? (
          <div className="space-y-8">
            {/* Overview */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Trades"
                value={trades.length.toString()}
                sub={`${roundTrips.length} round-trips`}
                icon={Activity}
                tooltipKey="Total Trades"
              />
              <MetricCard
                title="Positions Held"
                value={totalPositionsHeld.toString()}
                sub="Unique markets traded"
                icon={Layers}
                tooltipKey="Positions Held"
              />
              <MetricCard
                title="Buy Volume"
                value={formatUsdOrCompact(trades.filter((t) => t.side === "BUY").reduce((s, t) => s + t.usdcSize, 0))}
                icon={ArrowDownLeft}
                variant="positive"
                tooltipKey="Buy Volume"
              />
              <MetricCard
                title="Sell Volume"
                value={formatUsdOrCompact(trades.filter((t) => t.side === "SELL").reduce((s, t) => s + t.usdcSize, 0))}
                icon={ArrowUpRight}
                variant="negative"
                tooltipKey="Sell Volume"
              />
              <MetricCard
                title="Win Rate"
                value={formatPct(tradeMetrics.winRate)}
                sub={`${tradeMetrics.profitFactor.toFixed(2)} profit factor`}
                icon={Zap}
                variant={tradeMetrics.winRate >= 0.5 ? "positive" : "negative"}
                tooltipKey="Win Rate"
              />
            </div>

            {/* 1. Return Metrics */}
            <MetricSection title="1. Return Metrics" icon={TrendingUp}>
              <MetricsGrid>
                <MetricCard title="Total Return" value={formatReturnAsX(returnMetrics.totalReturn)} sub={`${formatUsdOrCompact(returnMetrics.totalPnl)} PnL`} icon={Percent} variant={returnMetrics.totalReturn >= 0 ? "positive" : "negative"} tooltipKey="Total Return" />
                <MetricCard title="Annualized Return" value={formatReturnAsX(returnMetrics.annualizedReturn)} icon={TrendingUp} variant={returnMetrics.annualizedReturn >= 0 ? "positive" : "negative"} tooltipKey="Annualized Return" />
                <MetricCard title="CAGR" value={formatReturnAsX(returnMetrics.cagr)} sub="Compound Annual Growth Rate" icon={Percent} tooltipKey="CAGR" />
                <MetricCard title="Geometric Return" value={formatReturnAsX(returnMetrics.geometricReturn)} icon={Percent} tooltipKey="Geometric Return" />
                <MetricCard title="Arithmetic Mean Return" value={formatReturnAsX(returnMetrics.arithmeticMeanReturn)} icon={Percent} tooltipKey="Arithmetic Mean Return" />
                <MetricCard title="Rolling Return (30d)" value={formatReturnAsX(returnMetrics.rollingReturn)} icon={Calendar} tooltipKey="Rolling Return (30d)" />
                <MetricCard title="Cumulative Return" value={formatReturnAsX(returnMetrics.cumulativeReturn)} icon={Target} tooltipKey="Cumulative Return" />
                <MetricCard title="Excess Return (vs CSPX)" value={formatReturnAsX(excessReturn)} sub="vs benchmark" icon={Target} variant={excessReturn >= 0 ? "positive" : "negative"} tooltipKey="Excess Return (vs CSPX)" />
              </MetricsGrid>
            </MetricSection>

            {/* 2. Risk-Adjusted Performance */}
            <MetricSection title="2. Risk-Adjusted Performance Metrics" icon={Shield}>
              <MetricsGrid>
                <MetricCard title="Sharpe Ratio" value={formatNum(riskAdjusted.sharpeRatio)} sub="Annualized" icon={Shield} tooltipKey="Sharpe Ratio" />
                <MetricCard title="Sortino Ratio" value={formatNum(riskAdjusted.sortinoRatio)} icon={Shield} tooltipKey="Sortino Ratio" />
                <MetricCard title="Information Ratio" value={benchComparison.informationRatio != null ? formatNum(benchComparison.informationRatio) : "—"} sub="vs CSPX" icon={Target} tooltipKey="Information Ratio" />
                <MetricCard title="Treynor Ratio" value={formatNum(riskAdjusted.treynorRatio)} icon={Shield} tooltipKey="Treynor Ratio" />
                <MetricCard title="Calmar Ratio" value={formatNum(riskAdjusted.calmarRatio)} icon={Shield} tooltipKey="Calmar Ratio" />
                <MetricCard title="Sterling Ratio" value={formatNum(riskAdjusted.sterlingRatio)} icon={Shield} tooltipKey="Sterling Ratio" />
                <MetricCard title="Omega Ratio" value={formatNum(riskAdjusted.omegaRatio)} icon={Shield} tooltipKey="Omega Ratio" />
                <MetricCard title="Burke Ratio" value={formatNum(riskAdjusted.burkeRatio)} icon={Shield} tooltipKey="Burke Ratio" />
                <MetricCard title="Gain-Loss Ratio" value={formatNum(riskAdjusted.gainLossRatio)} icon={Target} tooltipKey="Gain-Loss Ratio" />
                <MetricCard title="Modigliani (M²)" value={formatNum(riskAdjusted.modiglianiRatio)} icon={Shield} tooltipKey="Modigliani (M²)" />
              </MetricsGrid>
            </MetricSection>

            {/* 3. Risk Metrics */}
            <MetricSection title="3. Risk Metrics" icon={AlertTriangle}>
              <MetricsGrid>
                <MetricCard title="Volatility (Ann.)" value={formatPct(riskMetrics.volatility)} sub="Std Dev" icon={AlertTriangle} tooltipKey="Volatility (Ann.)" />
                <MetricCard title="Downside Deviation" value={formatPct(riskMetrics.downsideDeviation)} icon={AlertTriangle} tooltipKey="Downside Deviation" />
                <MetricCard title="Semi-Variance" value={formatNum(riskMetrics.semiVariance, 6)} icon={AlertTriangle} tooltipKey="Semi-Variance" />
                <MetricCard title="VaR 95%" value={formatPct(riskMetrics.var95)} icon={AlertTriangle} variant="negative" tooltipKey="VaR 95%" />
                <MetricCard title="CVaR 95%" value={formatPct(riskMetrics.cvar95)} sub="Expected Shortfall" icon={AlertTriangle} variant="negative" tooltipKey="CVaR 95%" />
                <MetricCard title="Tail Ratio" value={formatNum(riskMetrics.tailRatio)} icon={AlertTriangle} tooltipKey="Tail Ratio" />
                <MetricCard title="Skewness" value={formatNum(riskMetrics.skewness)} icon={AlertTriangle} tooltipKey="Skewness" />
                <MetricCard title="Kurtosis" value={formatNum(riskMetrics.kurtosis)} icon={AlertTriangle} tooltipKey="Kurtosis" />
                <MetricCard title="Ulcer Index" value={formatNum(riskMetrics.ulcerIndex)} icon={AlertTriangle} tooltipKey="Ulcer Index" />
              </MetricsGrid>
            </MetricSection>

            {/* 4. Drawdown Metrics */}
            <MetricSection title="4. Drawdown Metrics" icon={AlertTriangle}>
              <MetricsGrid>
                <MetricCard title="Max Drawdown" value={formatPct(drawdownMetrics.maxDrawdown)} icon={AlertTriangle} variant="negative" tooltipKey="Max Drawdown" />
                <MetricCard title="Average Drawdown" value={formatPct(drawdownMetrics.averageDrawdown)} icon={AlertTriangle} tooltipKey="Average Drawdown" />
                <MetricCard title="Drawdown Duration" value={`${drawdownMetrics.drawdownDuration} days`} icon={Calendar} tooltipKey="Drawdown Duration" />
                <MetricCard title="Recovery Time" value={`${drawdownMetrics.recoveryTime} days`} icon={Calendar} tooltipKey="Recovery Time" />
                <MetricCard title="Pain Index" value={formatPct(drawdownMetrics.painIndex)} icon={AlertTriangle} tooltipKey="Pain Index" />
                <MetricCard title="Pain Ratio" value={formatNum(drawdownMetrics.painRatio)} icon={AlertTriangle} tooltipKey="Pain Ratio" />
              </MetricsGrid>
            </MetricSection>

            {/* 5. Market Exposure / 6. Portfolio Efficiency */}
            <div className="grid gap-6 sm:grid-cols-2">
              <MetricSection title="5. Market Exposure (vs CSPX)" icon={Target}>
                <MetricsGrid>
                  <MetricCard title="Beta" value={benchComparison.beta != null ? formatNum(benchComparison.beta) : "—"} icon={Target} tooltipKey="Beta" />
                  <MetricCard title="Alpha (Jensen)" value={benchComparison.alpha != null ? formatReturnAsX(benchComparison.alpha) : "—"} icon={Target} variant={benchComparison.alpha != null && benchComparison.alpha >= 0 ? "positive" : "negative"} tooltipKey="Alpha (Jensen)" />
                  <MetricCard title="Tracking Error" value={benchComparison.trackingError != null ? formatPct(benchComparison.trackingError) : "—"} icon={Target} tooltipKey="Tracking Error" />
                  <MetricCard title="Active Return" value={benchComparison.activeReturn != null ? formatReturnAsX(benchComparison.activeReturn) : "—"} icon={Target} tooltipKey="Active Return" />
                </MetricsGrid>
              </MetricSection>
              <MetricSection title="6. Portfolio Efficiency" icon={Gauge}>
                <MetricsGrid>
                  <MetricCard title="Return over Max DD (RoMaD)" value={formatNum(portEfficiency.returnOverMaxDrawdown)} icon={Gauge} tooltipKey="Return over Max DD (RoMaD)" />
                  <MetricCard title="Kelly Fraction" value={formatPct(capEfficiency.kellyFraction)} sub="Optimal bet size" icon={Gauge} tooltipKey="Kelly Fraction" />
                  <MetricCard title="Risk of Ruin" value={formatPct(capEfficiency.riskOfRuin)} icon={AlertTriangle} variant="negative" tooltipKey="Risk of Ruin" />
                  <MetricCard title="Expected Growth Rate" value={formatReturnAsX(capEfficiency.expectedGrowthRate)} icon={TrendingUp} tooltipKey="Expected Growth Rate" />
                </MetricsGrid>
              </MetricSection>
            </div>

            {/* 7. Trade-Level Metrics */}
            <MetricSection title="7. Trade-Level Metrics" icon={Activity}>
              <MetricsGrid>
                <MetricCard title="Win Rate" value={formatPct(tradeMetrics.winRate)} icon={Target} tooltipKey="Win Rate" />
                <MetricCard title="Loss Rate" value={formatPct(tradeMetrics.lossRate)} icon={Target} tooltipKey="Loss Rate" />
                <MetricCard title="Average Win" value={formatUsdOrCompact(tradeMetrics.averageWin, 2)} icon={TrendingUp} variant="positive" tooltipKey="Average Win" />
                <MetricCard title="Average Loss" value={formatUsdOrCompact(tradeMetrics.averageLoss, 2)} icon={AlertTriangle} variant="negative" tooltipKey="Average Loss" />
                <MetricCard title="Largest Win" value={formatUsdOrCompact(tradeMetrics.largestWin, 2)} icon={TrendingUp} variant="positive" tooltipKey="Largest Win" />
                <MetricCard title="Largest Loss" value={formatUsdOrCompact(tradeMetrics.largestLoss, 2)} icon={AlertTriangle} variant="negative" tooltipKey="Largest Loss" />
                <MetricCard title="Profit Factor" value={formatNum(tradeMetrics.profitFactor)} icon={Target} tooltipKey="Profit Factor" />
                <MetricCard title="Expectancy" value={formatUsdOrCompact(tradeMetrics.expectancy, 2)} icon={Target} variant={tradeMetrics.expectancy >= 0 ? "positive" : "negative"} tooltipKey="Expectancy" />
                <MetricCard title="Payoff Ratio" value={formatNum(tradeMetrics.payoffRatio)} icon={Target} tooltipKey="Payoff Ratio" />
                <MetricCard title="Avg Holding Time" value={`${tradeMetrics.averageHoldingTime.toFixed(1)} days`} icon={Calendar} tooltipKey="Avg Holding Time" />
                <MetricCard title="Trade Frequency" value={`${tradeMetrics.tradeFrequency.toFixed(3)}/day`} icon={Activity} tooltipKey="Trade Frequency" />
              </MetricsGrid>
            </MetricSection>

            {/* 8. Distribution Metrics */}
            <MetricSection title="8. Distribution Metrics" icon={BarChart3}>
              <MetricsGrid>
                <MetricCard title="Mean Return" value={formatReturnAsX(distMetrics.meanReturn)} icon={Percent} tooltipKey="Mean Return" />
                <MetricCard title="Median Return" value={formatReturnAsX(distMetrics.medianReturn)} icon={Percent} tooltipKey="Median Return" />
                <MetricCard title="Variance" value={formatNum(distMetrics.variance, 6)} icon={BarChart3} tooltipKey="Variance" />
                <MetricCard title="Std Deviation" value={formatPct(distMetrics.standardDeviation)} icon={BarChart3} tooltipKey="Std Deviation" />
                <MetricCard title="P5" value={formatReturnAsX(distMetrics.percentile5)} icon={Percent} tooltipKey="P5" />
                <MetricCard title="P25" value={formatReturnAsX(distMetrics.percentile25)} icon={Percent} tooltipKey="P25" />
                <MetricCard title="P50" value={formatReturnAsX(distMetrics.percentile50)} icon={Percent} tooltipKey="P50" />
                <MetricCard title="P75" value={formatReturnAsX(distMetrics.percentile75)} icon={Percent} tooltipKey="P75" />
                <MetricCard title="P95" value={formatReturnAsX(distMetrics.percentile95)} icon={Percent} tooltipKey="P95" />
              </MetricsGrid>
            </MetricSection>

            {/* 9. Tail / Stress */}
            <MetricSection title="9. Tail / Stress Risk Metrics" icon={AlertTriangle}>
              <MetricsGrid>
                <MetricCard title="Stress Loss" value={formatPct(tailMetrics.stressLoss)} icon={AlertTriangle} variant="negative" tooltipKey="Stress Loss" />
                <MetricCard title="Tail Conditional Expectation" value={formatPct(tailMetrics.tailConditionalExpectation)} icon={AlertTriangle} tooltipKey="Tail Conditional Expectation" />
                <MetricCard title="Historical Stress Test" value={formatPct(tailMetrics.historicalStressTest)} icon={AlertTriangle} variant="negative" tooltipKey="Historical Stress Test" />
              </MetricsGrid>
            </MetricSection>

            {/* 10. Liquidity - N/A */}
            <MetricSection title="10. Liquidity Metrics" icon={Layers}>
              <p className="text-sm text-slate-500">
                Prediction market liquidity metrics (bid-ask, slippage, market impact) require order book data — not available from activity API. N/A for this dashboard.
              </p>
            </MetricSection>

            {/* 12. Portfolio Construction */}
            <MetricSection title="12. Portfolio Construction" icon={PieChart}>
              <MetricsGrid>
                <MetricCard title="Diversification Ratio" value={formatNum(portConstruction.diversificationRatio)} icon={PieChart} tooltipKey="Diversification Ratio" />
                <MetricCard title="Concentration (HHI)" value={formatNum(portConstruction.herfindahlIndex, 4)} sub="Herfindahl index" icon={PieChart} tooltipKey="Concentration (HHI)" />
              </MetricsGrid>
            </MetricSection>

            {/* Top markets */}
            <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50">
              <div className="border-b border-slate-700/50 px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  Top markets by volume
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {[...new Map(roundTrips.map((r) => [r.title, r])).entries()]
                  .map(([title, r]) => ({ title, vol: roundTrips.filter((x) => x.title === title).reduce((s, x) => s + x.buyUsdc + x.sellUsdc, 0) }))
                  .sort((a, b) => b.vol - a.vol)
                  .slice(0, 10)
                  .map((m, i) => (
                    <div key={m.title} className="flex items-center justify-between px-6 py-3">
                      <span className="font-medium text-white">{m.title}</span>
                      <span className="font-mono text-slate-400">{formatUsdOrCompact(m.vol, 0)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-8 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
              <BarChart3 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              No trading activity found
            </h3>
            <p className="mt-2 text-slate-400">
              Trading history will appear here once you have activity.
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          Benchmark: CSPX · Risk-free: {riskFreePct.toFixed(2)}% (Fed)
        </p>
      </div>
    </div>
  );
}
