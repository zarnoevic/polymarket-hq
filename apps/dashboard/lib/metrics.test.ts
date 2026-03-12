import { describe, it, expect } from "vitest";
import {
  TRADING_DAYS_PER_YEAR,
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
} from "./metrics";
import type { RoundTrip } from "./round-trip";
import type { MarketData } from "./benchmark";

function rt(overrides: Partial<RoundTrip>): RoundTrip {
  return {
    asset: "test",
    title: "Test",
    buyDate: 0,
    sellDate: 0,
    buyUsdc: 100,
    sellUsdc: 110,
    pnl: 10,
    percentPnl: 10,
    holdingDays: 1,
    ...overrides,
  };
}

function ts(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

describe("buildEquityCurve", () => {
  it("returns empty series for no round trips", () => {
    const curve = buildEquityCurve([], 10000);
    expect(curve.dates).toEqual([]);
    expect(curve.equity).toEqual([]);
    expect(curve.returns).toEqual([]);
  });

  it("uses full calendar series with zero returns on non-trading days", () => {
    // 2 trades on different days, 5 days apart
    const trips = [
      rt({ sellDate: ts("2024-01-01"), pnl: 100 }),
      rt({ sellDate: ts("2024-01-06"), pnl: 50 }), // 5 days later
    ];
    const curve = buildEquityCurve(trips, 10000);
    // Should have 6 calendar days (Jan 1 through Jan 6 inclusive)
    expect(curve.dates.length).toBe(6);
    expect(curve.dates[0]).toBe("2024-01-01");
    expect(curve.dates[5]).toBe("2024-01-06");
    // Day 1: return = 100/10000 = 0.01, equity = 10100
    expect(curve.returns[0]).toBeCloseTo(0.01, 6);
    expect(curve.equity[0]).toBe(10100);
    // Days 2-5: return = 0 (no trades), equity unchanged
    for (let i = 1; i <= 4; i++) {
      expect(curve.returns[i]).toBe(0);
      expect(curve.equity[i]).toBe(10100);
    }
    // Day 6: return = 50/10100
    expect(curve.returns[5]).toBeCloseTo(50 / 10100, 6);
    expect(curve.equity[5]).toBe(10150);
  });

  it("aggregates multiple round trips on same day", () => {
    const trips = [
      rt({ sellDate: ts("2024-01-01"), pnl: 50 }),
      rt({ sellDate: ts("2024-01-01"), pnl: 50 }),
    ];
    const curve = buildEquityCurve(trips, 10000);
    expect(curve.dates.length).toBe(1);
    expect(curve.returns[0]).toBeCloseTo(0.01, 6); // 100/10000
    expect(curve.equity[0]).toBe(10100);
  });
});

describe("computeReturnMetrics", () => {
  it("computes total return and CAGR correctly", () => {
    const trips = [
      rt({ sellDate: ts("2024-01-01"), pnl: 500 }),
      rt({ sellDate: ts("2024-12-31"), pnl: 500 }),
    ];
    const curve = buildEquityCurve(trips, 10000);
    const m = computeReturnMetrics(trips, curve, 10000);
    expect(m.totalPnl).toBe(1000);
    expect(m.cumulativeReturn).toBeCloseTo(0.1, 6); // 1000/10000
    expect(m.finalEquity).toBe(11000);
    // CAGR over ~1 year: (11000/10000)^(1/years) - 1. 2024 is leap year so ~366 days.
    expect(m.cagr).toBeGreaterThan(0.09);
    expect(m.cagr).toBeLessThan(0.11);
    expect(m.annualizedReturn).toBe(m.cagr);
  });

  it("CAGR matches geometric growth for volatile returns", () => {
    // 365 days of small positive returns → CAGR should match
    const startTs = ts("2024-01-01");
    const trips = Array.from({ length: 365 }, (_, i) =>
      rt({
        sellDate: startTs + (i + 1) * 86400,
        pnl: 2.74, // ~10% annual: 10000 * 0.1 / 365 ≈ 2.74
      })
    );
    const curve = buildEquityCurve(trips, 10000);
    const m = computeReturnMetrics(trips, curve, 10000);
    // Final ≈ 11000, CAGR ≈ 0.1
    expect(m.cagr).toBeGreaterThan(0.08);
    expect(m.cagr).toBeLessThan(0.12);
  });
});

describe("computeRiskAdjustedMetrics", () => {
  const baseMarket: MarketData = {
    cspx: null,
    riskFreeRateAnnual: 0.05,
  };

  it("Sharpe is capped at 3 when sample < 60 days", () => {
    // Create 30 days with very high returns → would compute Sharpe >> 3
    const startTs = ts("2024-01-01");
    const trips = Array.from({ length: 15 }, (_, i) =>
      rt({
        sellDate: startTs + (i + 1) * 2 * 86400, // every 2 days
        pnl: 100,
      })
    );
    const curve = buildEquityCurve(trips, 10000);
    const m = computeRiskAdjustedMetrics(curve, baseMarket, trips);
    expect(m.sharpeRatio).toBeLessThanOrEqual(3);
    expect(m.sortinoRatio).toBeLessThanOrEqual(3);
  });

  it("Sharpe formula: excessRetAnn / volAnn", () => {
    // 100 days of constant 0.1% daily return, rf 0.05/365
    const startTs = ts("2024-01-01");
    const dailyRet = 0.001;
    const trips = Array.from({ length: 100 }, (_, i) =>
      rt({
        sellDate: startTs + (i + 1) * 86400,
        pnl: 10000 * dailyRet, // 0.1% of 10k
      })
    );
    const curve = buildEquityCurve(trips, 10000);
    // Equity grows; for constant % we approximate
    const m = computeRiskAdjustedMetrics(curve, baseMarket, trips);
    // Vol should be low (nearly constant returns), Sharpe could be high
    expect(m.sharpeRatio).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(m.sharpeRatio)).toBe(true);
  });

  it("gain-loss ratio from round trips", () => {
    const trips = [
      rt({ pnl: 100 }),
      rt({ pnl: 100 }),
      rt({ pnl: -50 }),
    ];
    const curve = buildEquityCurve(trips, 10000);
    const m = computeRiskAdjustedMetrics(curve, baseMarket, trips);
    // totalWin=200, totalLoss=50, ratio=4
    expect(m.gainLossRatio).toBeCloseTo(4, 4);
  });

  it("Sharpe formula: excessRetAnn / volAnn with known values", () => {
    // 100 days with varying returns so vol > 0. Mean ~0.05%, mix of +/- to get realistic vol.
    // Verifies formula produces finite positive Sharpe when sample is large enough.
    const startTs = ts("2024-01-01");
    const pnls = Array.from({ length: 100 }, (_, i) =>
      i % 3 === 0 ? 10 : i % 3 === 1 ? -5 : 7
    ); // alternating to create variance
    const trips = pnls.map((pnl, i) =>
      rt({ sellDate: startTs + (i + 1) * 86400, pnl })
    );
    const curve = buildEquityCurve(trips, 10000);
    const m = computeRiskAdjustedMetrics(curve, baseMarket, trips);
    expect(m.sharpeRatio).toBeGreaterThan(0);
    expect(Number.isFinite(m.sharpeRatio)).toBe(true);
  });

  it("omega ratio: gains above threshold / losses below", () => {
    const trips = [rt({ pnl: 100 }), rt({ pnl: -25 })];
    const curve = buildEquityCurve(trips, 10000);
    const m = computeRiskAdjustedMetrics(curve, baseMarket, trips);
    // Depends on returns; gainsAbove and lossesBelow from returns
    expect(m.omegaRatio).toBeGreaterThanOrEqual(0);
  });
});

describe("computeRiskMetrics", () => {
  it("volatility annualization: std * sqrt(365)", () => {
    const curve = buildEquityCurve(
      [rt({ sellDate: ts("2024-01-01"), pnl: 100 }), rt({ sellDate: ts("2024-01-02"), pnl: -50 })],
      10000
    );
    const m = computeRiskMetrics(curve, []);
    expect(m.volatilityDaily).toBeGreaterThanOrEqual(0);
    expect(m.volatility).toBeCloseTo(m.volatilityDaily * Math.sqrt(TRADING_DAYS_PER_YEAR), 4);
  });

  it("VaR95 and CVaR95 from sorted returns", () => {
    const startTs = ts("2024-01-01");
    const pnls = [10, -20, 5, -30, 15, -10, 8, 12, -5, 20]; // mix of wins/losses
    const trips = pnls.map((pnl, i) => rt({ sellDate: startTs + (i + 1) * 86400, pnl }));
    const curve = buildEquityCurve(trips, 10000);
    const m = computeRiskMetrics(curve, trips);
    expect(m.var95).toBeLessThanOrEqual(0);
    expect(m.cvar95).toBeLessThanOrEqual(m.var95);
  });
});

describe("computeDrawdownMetrics", () => {
  it("max drawdown from peak-to-trough", () => {
    // Equity: 100, 110, 105, 95, 100 → max DD = (110-95)/110 ≈ 13.6%
    const curve = {
      dates: ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
      equity: [100, 110, 105, 95, 100],
      returns: [0.1, -0.045, -0.095, 0.053],
    };
    const m = computeDrawdownMetrics(curve);
    expect(m.maxDrawdown).toBeCloseTo(-(110 - 95) / 110, 4); // negative
    expect(m.maxDrawdown).toBeLessThan(0);
  });

  it("no drawdown when equity only rises", () => {
    const curve = {
      dates: ["2024-01-01", "2024-01-02"],
      equity: [100, 110],
      returns: [0.1],
    };
    const m = computeDrawdownMetrics(curve);
    // Can be 0 or -0 (Object.is distinguishes); effectively zero
    expect(Math.abs(m.maxDrawdown)).toBeLessThan(0.001);
  });
});

describe("computeTradeMetrics", () => {
  it("win rate and profit factor", () => {
    const trips = [
      rt({ pnl: 100 }),
      rt({ pnl: 50 }),
      rt({ pnl: -30 }),
      rt({ pnl: -20 }),
    ];
    const m = computeTradeMetrics(trips);
    expect(m.winRate).toBeCloseTo(0.5, 4); // 2 wins
    expect(m.lossRate).toBeCloseTo(0.5, 4);
    expect(m.profitFactor).toBeCloseTo(150 / 50, 4); // 3
    expect(m.expectancy).toBeCloseTo(100 / 4, 4); // 25
  });

  it("payoff ratio = avgWin / avgLoss", () => {
    const trips = [
      rt({ pnl: 100 }),
      rt({ pnl: 100 }),
      rt({ pnl: -50 }),
    ];
    const m = computeTradeMetrics(trips);
    expect(m.payoffRatio).toBeCloseTo(100 / 50, 4); // 2
  });
});

describe("computeDistributionMetrics", () => {
  it("percentiles from sorted returns", () => {
    const curve = buildEquityCurve(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
        rt({ sellDate: ts("2024-01-01") + i * 86400, pnl: i - 5 })
      ),
      100
    );
    const m = computeDistributionMetrics(curve);
    expect(m.meanReturn).toBeDefined();
    expect(m.percentile50).toBeDefined();
    expect(m.standardDeviation).toBeGreaterThanOrEqual(0);
  });
});

describe("computeTailMetrics", () => {
  it("stress loss is worst return", () => {
    const curve = buildEquityCurve(
      [
        rt({ sellDate: ts("2024-01-01"), pnl: 10 }),
        rt({ sellDate: ts("2024-01-02"), pnl: -50 }),
      ],
      100
    );
    const m = computeTailMetrics(curve);
    expect(m.stressLoss).toBeLessThanOrEqual(0);
    expect(m.historicalStressTest).toBe(m.stressLoss);
  });
});

describe("computeLiquidityMetrics", () => {
  it("returns null placeholders", () => {
    const m = computeLiquidityMetrics();
    expect(m.bidAskSpread).toBeNull();
    expect(m.slippage).toBeNull();
  });
});

describe("computePortfolioConstruction", () => {
  it("HHI and diversification", () => {
    const trips = [
      rt({ title: "A", pnl: 100 }),
      rt({ title: "B", pnl: 100 }),
      rt({ title: "C", pnl: 100 }),
    ];
    const m = computePortfolioConstruction(trips);
    // Equal weights: 1/3 each, HHI = 3 * (1/9) = 1/3
    expect(m.herfindahlIndex).toBeCloseTo(1 / 3, 4);
    expect(m.concentration).toBe(m.herfindahlIndex);
    expect(m.diversificationRatio).toBeGreaterThan(1);
  });
});

describe("computeCapitalEfficiency", () => {
  it("Kelly fraction bounded [0,1]", () => {
    const trips = [rt({ pnl: 10 }), rt({ pnl: -5 })];
    const curve = buildEquityCurve(trips, 100);
    const m = computeCapitalEfficiency(trips, curve, 100);
    expect(m.kellyFraction).toBeGreaterThanOrEqual(0);
    expect(m.kellyFraction).toBeLessThanOrEqual(1);
  });
});

describe("computeBenchmarkComparison", () => {
  it("returns nulls when no cspx", () => {
    const market: MarketData = { cspx: null, riskFreeRateAnnual: 0.05 };
    const curve = buildEquityCurve([rt({ sellDate: ts("2024-01-01"), pnl: 100 })], 10000);
    const m = computeBenchmarkComparison(curve, market);
    expect(m.trackingError).toBeNull();
    expect(m.informationRatio).toBeNull();
    expect(m.alpha).toBeNull();
  });

  it("computes beta and alpha when cspx aligned", () => {
    const market: MarketData = {
      cspx: {
        dates: [ts("2024-01-01"), ts("2024-01-02")],
        prices: [100, 101],
        returns: [0.01, 0.005],
      },
      riskFreeRateAnnual: 0.05,
    };
    const curve = buildEquityCurve(
      [
        rt({ sellDate: ts("2024-01-01"), pnl: 100 }),
        rt({ sellDate: ts("2024-01-02"), pnl: 50 }),
      ],
      10000
    );
    const m = computeBenchmarkComparison(curve, market);
    expect(m.trackingError).not.toBeNull();
    expect(m.beta).not.toBeNull();
    expect(typeof m.alpha).toBe("number");
  });
});

describe("computeExcessReturn", () => {
  it("returns total when no cspx (excess = total - 0)", () => {
    const market: MarketData = { cspx: null, riskFreeRateAnnual: 0.05 };
    const excess = computeExcessReturn(0.15, market, 1);
    expect(excess).toBe(0.15);
  });

  it("excess = total - benchmark when cspx present", () => {
    const market: MarketData = {
      cspx: {
        dates: [ts("2024-01-01")],
        prices: [100],
        returns: [0.1], // 10% daily (unrealistic, for test)
      },
      riskFreeRateAnnual: 0.05,
    };
    const excess = computeExcessReturn(0.15, market, 1);
    // benchReturn = 0.1 * 365 * 1 = 36.5, total = 0.15
    expect(excess).toBeCloseTo(0.15 - 36.5, 2);
  });
});

describe("computePortfolioEfficiency", () => {
  it("returnOverMaxDrawdown = annualized return / |maxDD|", () => {
    const curve = buildEquityCurve(
      [
        rt({ sellDate: ts("2024-01-01"), pnl: 100 }),
        rt({ sellDate: ts("2024-01-02"), pnl: -50 }),
      ],
      1000
    );
    const dd = computeDrawdownMetrics(curve);
    const m = computePortfolioEfficiency(curve, dd);
    expect(m.returnOverMaxDrawdown).toBeGreaterThanOrEqual(0);
    expect(m.calmarRatio).toBe(m.returnOverMaxDrawdown);
  });
});
