import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const DEFAULT_LIMIT = 10_000;
const MAX_LIMIT = 20_000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const events = await prisma.screenerEvent.findMany({
      where: {
        endDate: { gte: now },
      },
      orderBy: [{ syncedAt: "desc" }, { endDate: "asc" }, { volume: "desc" }],
      take: limit,
    });
    // Appraised events first; among those, sort by quoted probability closest to 50%, then max(YEV, NEV)
    const sorted = [...events].sort((a, b) => {
      const hasAppraisal = (e: (typeof events)[0]) => e.yev != null && e.nev != null;
      const appraisedA = hasAppraisal(a) ? 1 : 0;
      const appraisedB = hasAppraisal(b) ? 1 : 0;
      if (appraisedA !== appraisedB) return appraisedB - appraisedA; // appraised first
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      if (distA !== distB) return distA - distB;
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
