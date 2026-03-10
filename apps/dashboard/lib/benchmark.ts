export type BenchmarkData = {
  dates: number[];
  prices: number[];
  returns: number[];
};

export type MarketData = {
  cspx: BenchmarkData | null;
  riskFreeRateAnnual: number; // e.g. 0.0433 for 4.33%
};

async function fetchCspx(): Promise<BenchmarkData | null> {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 2 * 365 * 86400; // 2 years
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/CSPX.L?interval=1d&period1=${from}&period2=${to}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // 24h
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
            adjclose?: Array<{ adjclose?: (number | null)[] }>;
          };
        }>;
      };
    };

    const result = json?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quotes = result?.indicators?.quote?.[0]?.close ?? result?.indicators?.adjclose?.[0]?.adjclose ?? [];
    const closes = quotes.map((c) => (c != null ? c : 0)).filter((c) => c > 0);

    if (timestamps.length < 2 || closes.length < 2) return null;

    const alignedLen = Math.min(timestamps.length, closes.length);
    const dates = timestamps.slice(0, alignedLen);
    const prices = closes.slice(0, alignedLen);

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const r = (prices[i]! - prices[i - 1]!) / (prices[i - 1]! || 1);
      returns.push(r);
    }

    return { dates: dates.slice(1), prices: prices.slice(1), returns };
  } catch {
    return null;
  }
}

async function fetchRiskFreeRate(): Promise<number> {
  const key = process.env.FRED_API_KEY;
  if (key) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (res.ok) {
        const json = (await res.json()) as { observations?: Array<{ value?: string }> };
        const v = json?.observations?.[0]?.value;
        if (v) return parseFloat(v) / 100;
      }
    } catch {
      // fallback
    }
  }
  // Fallback: approximate Fed funds rate
  return 0.0433;
}

export async function fetchMarketData(): Promise<MarketData> {
  const [cspx, riskFreeRateAnnual] = await Promise.all([
    fetchCspx(),
    fetchRiskFreeRate(),
  ]);

  return { cspx, riskFreeRateAnnual };
}
