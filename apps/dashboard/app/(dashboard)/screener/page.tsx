import type { ComponentProps } from "react";
import { prisma } from "@polymarket-hq/dashboard-prisma";
import { ScreenerContent } from "../../components/ScreenerContent";

export const dynamic = "force-dynamic";

const EVENTS_LIMIT = 10_000;

export default async function ScreenerPage() {
  const events = await prisma.screenerEvent.findMany({
    where: { endDate: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
    orderBy: [{ endDate: "asc" }, { volume: "desc" }, { syncedAt: "desc" }],
    take: EVENTS_LIMIT,
  });
  // Sort by max(YEV, NEV) descending; events without appraisal go last
  const sorted = [...events].sort((a, b) => {
    const maxA = a.yev != null && a.nev != null ? Math.max(a.yev, a.nev) : -1;
    const maxB = b.yev != null && b.nev != null ? Math.max(b.yev, b.nev) : -1;
    return maxB - maxA;
  });

  // Narrow kellyPosition from Prisma's string to "yes" | "no" for ScreenerContent
  const normalized = sorted.map((e) => ({
    ...e,
    kellyPosition:
      e.kellyPosition === "yes" ? "yes" : e.kellyPosition === "no" ? "no" : null,
  }));

  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto w-[90vw] max-w-[90vw] px-4 py-12">
        <ScreenerContent
          initialEvents={
            normalized as ComponentProps<typeof ScreenerContent>["initialEvents"]
          }
        />
      </div>
    </div>
  );
}
