const DEFAULT_WALLET = "0x25012ec798e4861e38c645df919f86dc3c177e28";

export function getWallet(): string {
  return process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;
}

/** Initial equity for metrics. Use POLYMARKET_INITIAL_EQUITY if set, else max(10k, totalBuyVolume×0.3) */
export function getInitialEquity(totalBuyVolume: number): number {
  const env = process.env.POLYMARKET_INITIAL_EQUITY;
  if (env != null && env !== "") {
    const n = parseFloat(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Math.max(10_000, totalBuyVolume * 0.3);
}

export type ActivityEntry = {
  proxyWallet: string;
  timestamp: number;
  conditionId: string;
  type: string;
  size: number;
  usdcSize: number;
  transactionHash: string;
  price: number;
  asset: string;
  side: "BUY" | "SELL";
  outcomeIndex: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
};

export async function fetchActivity(): Promise<ActivityEntry[]> {
  const wallet = getWallet();

  try {
    const url = new URL("https://data-api.polymarket.com/activity");
    url.searchParams.set("limit", "500");
    url.searchParams.set("sortBy", "TIMESTAMP");
    url.searchParams.set("sortDirection", "DESC");
    url.searchParams.set("user", wallet);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data) ? data.filter((a: ActivityEntry) => a.type === "TRADE") : [];
  } catch {
    return [];
  }
}
