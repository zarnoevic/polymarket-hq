import { describe, it, expect } from "vitest";
import { computeKellyCriterion } from "./kelly";

/**
 * Kelly Criterion formula: f* = p - (1-p)/b
 * where b = (1 - buyPrice) / buyPrice = net profit per unit staked
 * (when you pay buyPrice and receive 1 if you win)
 *
 * References:
 * - Wikipedia: f* = p - q/b, b = profit per unit staked
 * - Example: p=0.6, b=1 (even money) → f* = 0.6 - 0.4/1 = 0.2 (20%)
 */

describe("computeKellyCriterion", () => {
  it("Wikipedia example: p=0.6, even-money odds (b=1), full Kelly = 20%", () => {
    // Even money: buy at 0.5, win 1. So b = (1-0.5)/0.5 = 1
    const result = computeKellyCriterion(0.6, 0.5, 1);
    expect(result).toBeCloseTo(0.2, 6); // 20% full Kelly
  });

  it("no edge when p equals buyPrice (fair odds)", () => {
    // p = 0.5, buyPrice = 0.5 → b = 1, f = 0.5 - 0.5/1 = 0
    const result = computeKellyCriterion(0.5, 0.5, 1);
    expect(result).toBeCloseTo(0, 6);
  });

  it("negative Kelly when p < buyPrice (no bet)", () => {
    // We think 40%, market says 50%. No edge.
    const result = computeKellyCriterion(0.4, 0.5, 1);
    expect(result).toBeLessThan(0);
  });

  it("fractional Kelly divides by c", () => {
    // Full Kelly = 0.2, half Kelly (c=2) = 0.1
    const full = computeKellyCriterion(0.6, 0.5, 1);
    const half = computeKellyCriterion(0.6, 0.5, 2);
    expect(full).toBeCloseTo(0.2, 6);
    expect(half).toBeCloseTo(0.1, 6);
  });

  it("quarter Kelly (c=4)", () => {
    const result = computeKellyCriterion(0.6, 0.5, 4);
    expect(result).toBeCloseTo(0.05, 6); // 5%
  });

  it("high edge: p=0.8, buyPrice=0.5", () => {
    // b = 0.5/0.5 = 1, f = 0.8 - 0.2/1 = 0.6
    const result = computeKellyCriterion(0.8, 0.5, 1);
    expect(result).toBeCloseTo(0.6, 6);
  });

  it("low price (high odds): buyPrice=0.2, p=0.5", () => {
    // b = 0.8/0.2 = 4, f = 0.5 - 0.5/4 = 0.5 - 0.125 = 0.375
    const result = computeKellyCriterion(0.5, 0.2, 1);
    expect(result).toBeCloseTo(0.375, 6);
  });

  it("returns null for invalid p (0 or 1)", () => {
    expect(computeKellyCriterion(0, 0.5, 1)).toBeNull();
    expect(computeKellyCriterion(1, 0.5, 1)).toBeNull();
  });

  it("returns null for invalid buyPrice (0 or 1)", () => {
    expect(computeKellyCriterion(0.6, 0, 1)).toBeNull();
    expect(computeKellyCriterion(0.6, 1, 1)).toBeNull();
  });

  it("returns null for invalid c (0 or negative)", () => {
    expect(computeKellyCriterion(0.6, 0.5, 0)).toBeNull();
    expect(computeKellyCriterion(0.6, 0.5, -1)).toBeNull();
  });

  it("returns null for buyPrice >= 1 or <= 0", () => {
    expect(computeKellyCriterion(0.6, 0.99, 1)).not.toBeNull(); // 0.99 is valid
    expect(computeKellyCriterion(0.6, 1, 1)).toBeNull();
    expect(computeKellyCriterion(0.6, 0.01, 1)).not.toBeNull(); // 0.01 is valid
    expect(computeKellyCriterion(0.6, 0, 1)).toBeNull();
  });

  it("realistic Polymarket case: 65% conviction, market at 55%, c=4", () => {
    // Buy YES at 0.55, we think 65% true
    const result = computeKellyCriterion(0.65, 0.55, 4);
    // b = 0.45/0.55 ≈ 0.818, fullKelly = 0.65 - 0.35/0.818 ≈ 0.222, quarter = 0.0555
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.1); // Fractional should be moderate
  });

  it("spread sensitivity: buyPrice affects Kelly significantly", () => {
    // Same conviction (65%), but different buy prices
    const at55 = computeKellyCriterion(0.65, 0.55, 4)!;
    const at60 = computeKellyCriterion(0.65, 0.6, 4)!;
    const at50 = computeKellyCriterion(0.65, 0.5, 4)!;
    // Higher buyPrice = worse odds = lower Kelly. Lower buyPrice = better odds = higher Kelly
    expect(at50).toBeGreaterThan(at55);
    expect(at55).toBeGreaterThan(at60);
  });
});
