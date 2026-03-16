import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

/** Returns the last screener refresh metadata from SyncLog (for progress bar & last refresh time). */
export async function GET() {
  try {
    const last = await prisma.syncLog.findFirst({
      where: { source: "gamma-screener", status: "success" },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        finishedAt: true,
        recordCount: true,
      },
    });

    if (!last?.finishedAt) {
      return NextResponse.json({
        lastRefreshAt: null,
        durationMs: null,
        recordCount: null,
      });
    }

    const durationMs = last.finishedAt.getTime() - last.startedAt.getTime();

    return NextResponse.json({
      lastRefreshAt: last.finishedAt.toISOString(),
      durationMs,
      recordCount: last.recordCount ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch refresh status" },
      { status: 500 }
    );
  }
}
