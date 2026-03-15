/**
 * Kelly Criterion for binary prediction market bets.
 *
 * Formula (Wikipedia): f* = p - (1-p)/b
 * - p = probability of winning (the outcome you're betting on)
 * - b = net odds = (1 - buyPrice) / buyPrice = profit per unit staked
 * - buyPrice = price paid per share (each share pays 1 if you win)
 *
 * For fractional Kelly (conservative): f_fractional = f* / c
 */
export function computeKellyCriterion(
  p: number,
  buyPrice: number,
  c: number
): number | null {
  if (c <= 0 || !Number.isFinite(c)) return null;
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return null;
  if (p <= 0 || p >= 1 || !Number.isFinite(p)) return null;

  const b = (1 - buyPrice) / buyPrice;
  if (b <= 0 || !Number.isFinite(b)) return null;

  const q = 1 - p;
  const fullKelly = p - q / b;
  const fractionalKelly = fullKelly / c;

  return Number.isFinite(fractionalKelly) ? fractionalKelly : null;
}
