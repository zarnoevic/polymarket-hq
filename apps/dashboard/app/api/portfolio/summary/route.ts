import { NextResponse } from "next/server";

const DEFAULT_WALLET = "0x25012ec798e4861e38c645df919f86dc3c177e28";
const USDC_E_POLYGON = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174" as const;
const POLYGON_RPCS = [
  process.env.POLYGON_RPC_URL,
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
].filter(Boolean) as string[];

async function fetchUsdcBalance(): Promise<number | null> {
  const wallet = process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;
  const addr = wallet.toLowerCase().startsWith("0x")
    ? wallet.slice(2).padStart(64, "0")
    : wallet.padStart(64, "0");
  const data = `0x70a08231${addr}`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: USDC_E_POLYGON.toLowerCase(), data }, "latest"],
  });

  for (const rpc of POLYGON_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.error) continue;
      const hex = json?.result;
      if (typeof hex !== "string") continue;
      if (hex === "0x" || hex === "0x0") return 0;
      const raw = BigInt(hex);
      return Number(raw) / 1e6;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchTotalValue(): Promise<number | null> {
  const wallet = process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;
  try {
    const url = new URL("https://data-api.polymarket.com/value");
    url.searchParams.set("user", wallet);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const entry = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return entry?.value != null ? Number(entry.value) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [cash, positionsValue] = await Promise.all([
      fetchUsdcBalance(),
      fetchTotalValue(),
    ]);
    const portfolioValue = (cash ?? 0) + (positionsValue ?? 0);
    const cashPct = portfolioValue > 0 && cash != null
      ? (cash / portfolioValue) * 100
      : null;

    return NextResponse.json({
      portfolioValue: portfolioValue > 0 ? portfolioValue : null,
      cash: cash != null ? cash : null,
      cashPct,
      positionsValue: positionsValue != null ? positionsValue : null,
    });
  } catch (err) {
    console.error("Portfolio summary error:", err);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
