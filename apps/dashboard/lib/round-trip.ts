import type { ActivityEntry } from "./polymarket";

/** Matched buy/sell round-trip with P&L */
export type RoundTrip = {
  asset: string;
  title: string;
  buyDate: number;
  sellDate: number;
  buyUsdc: number;
  sellUsdc: number;
  pnl: number;
  percentPnl: number;
  holdingDays: number;
};

/** FIFO match buys to sells by asset */
export function matchRoundTrips(trades: ActivityEntry[]): RoundTrip[] {
  const byAsset = new Map<
    string,
    { buys: Array<{ ts: number; size: number; usdc: number }>; sells: Array<{ ts: number; size: number; usdc: number }> }
  >();

  for (const t of trades) {
    const key = t.asset;
    if (!byAsset.has(key)) {
      byAsset.set(key, { buys: [], sells: [] });
    }
    const entry = byAsset.get(key)!;
    const item = { ts: t.timestamp, size: t.size, usdc: t.usdcSize };
    if (t.side === "BUY") entry.buys.push(item);
    else entry.sells.push(item);
  }

  const roundTrips: RoundTrip[] = [];
  const titleByAsset = new Map<string, string>();
  for (const t of trades) {
    titleByAsset.set(t.asset, t.title);
  }

  for (const [asset, { buys, sells }] of byAsset.entries()) {
    buys.sort((a, b) => a.ts - b.ts);
    sells.sort((a, b) => a.ts - b.ts);

    let buyIdx = 0;
    let sellIdx = 0;
    let buyQueue: Array<{ ts: number; size: number; usdc: number; remaining: number }> = [];

    while (sellIdx < sells.length) {
      const sell = sells[sellIdx];
      let remainingSell = sell.size;

      while (remainingSell > 0 && (buyIdx < buys.length || buyQueue.length > 0)) {
        while (buyQueue.length === 0 && buyIdx < buys.length) {
          const b = buys[buyIdx++];
          buyQueue.push({ ...b, remaining: b.size });
        }
        if (buyQueue.length === 0) break;

        const firstBuy = buyQueue[0];
        const matchSize = Math.min(firstBuy.remaining, remainingSell);
        const buyCost = (firstBuy.usdc / firstBuy.size) * matchSize;
        const sellProceeds = (sell.usdc / sell.size) * matchSize;
        const pnl = sellProceeds - buyCost;
        const percentPnl = buyCost > 0 ? (pnl / buyCost) * 100 : 0;
        const buyTs = firstBuy.ts;
        const holdingDays = (sell.ts - buyTs) / 86400;

        roundTrips.push({
          asset,
          title: titleByAsset.get(asset) ?? "",
          buyDate: buyTs,
          sellDate: sell.ts,
          buyUsdc: buyCost,
          sellUsdc: sellProceeds,
          pnl,
          percentPnl,
          holdingDays,
        });

        firstBuy.remaining -= matchSize;
        remainingSell -= matchSize;
        if (firstBuy.remaining <= 0) buyQueue.shift();
      }
      sellIdx++;
    }
  }

  return roundTrips.sort((a, b) => a.sellDate - b.sellDate);
}
