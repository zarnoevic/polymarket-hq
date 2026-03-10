import { NextRequest, NextResponse } from "next/server";

const POLYMARKET_API = "https://data-api.polymarket.com/v1/leaderboard";

const DEFAULT_WALLET = "0x25012ec798e4861e38c645df919f86dc3c177e28";

export async function GET(request: NextRequest) {
  const wallet =
    request.nextUrl.searchParams.get("user") ??
    process.env.POLYMARKET_MAIN_WALLET ??
    DEFAULT_WALLET;

  try {
    const url = new URL(POLYMARKET_API);
    url.searchParams.set("category", "OVERALL");
    url.searchParams.set("timePeriod", "ALL");
    url.searchParams.set("orderBy", "PNL");
    url.searchParams.set("limit", "25");
    url.searchParams.set("user", wallet);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch leaderboard" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
