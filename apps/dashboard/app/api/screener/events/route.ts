import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

export async function GET() {
  try {
    const events = await prisma.screenerEvent.findMany({
      orderBy: [{ endDate: "asc" }, { volume: "desc" }, { syncedAt: "desc" }],
      take: 500,
    });
    // Sort by max(YEV, NEV) descending when available; events without appraisal go last
    const sorted = [...events].sort((a, b) => {
      const maxA = a.yev != null && a.nev != null ? Math.max(a.yev, a.nev) : -1;
      const maxB = b.yev != null && b.nev != null ? Math.max(b.yev, b.nev) : -1;
      return maxB - maxA;
    });
    return NextResponse.json(sorted);
  } catch (err) {
    console.error("Screener events fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
