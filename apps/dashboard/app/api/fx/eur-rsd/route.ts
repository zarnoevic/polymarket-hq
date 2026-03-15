import { NextResponse } from "next/server";

const EXCHANGE_API = "https://open.er-api.com/v6/latest/EUR";

/** Historical range for percentile (RSD per EUR) - typical 2023-2026 range */
const HISTORICAL_LOW = 115;
const HISTORICAL_HIGH = 120;

export async function GET() {
  try {
    const res = await fetch(EXCHANGE_API, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.RSD;
    if (typeof rate !== "number") throw new Error("Invalid response");
    const percentile =
      ((rate - HISTORICAL_LOW) / (HISTORICAL_HIGH - HISTORICAL_LOW)) * 100;
    return NextResponse.json({
      rate: Math.round(rate * 100) / 100,
      percentile: Math.round(Math.min(100, Math.max(0, percentile)) * 10) / 10,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
