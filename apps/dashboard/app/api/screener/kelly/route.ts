import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";
import { computeKellyCriterion } from "@/lib/kelly";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId, traderAppraisedYes, kellyC, kellyPosition } = body as {
      eventId: string;
      traderAppraisedYes?: number; // 0-1
      kellyC?: number; // scaling factor, positive
      kellyPosition?: "yes" | "no";
    };
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId required" },
        { status: 400 }
      );
    }

    const event = await prisma.screenerEvent.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Use provided values or fall back to stored values (for position-only toggle)
    const p = typeof traderAppraisedYes === "number" ? traderAppraisedYes : event.traderAppraisedYes;
    const c = typeof kellyC === "number" ? kellyC : event.kellyC;
    const position = kellyPosition === "no" ? "no" : "yes";
    const quotedYes = event.probabilityYes ?? (event.probabilityNo != null ? 1 - event.probabilityNo : null);
    const quotedNo = event.probabilityNo ?? (event.probabilityYes != null ? 1 - event.probabilityYes : null);
    // Normalize to 0-1: if value > 1, assume stored as percent (0-100) — fixes spread/prob from wrong units
    const toDec = (v: number | null | undefined) =>
      v != null && Number.isFinite(v) ? (v > 1 ? v / 100 : v) : 0;
    const qYes = quotedYes != null ? toDec(quotedYes) : null;
    const qNo = quotedNo != null ? toDec(quotedNo) : null;
    const spYes = toDec(event.yesSpread);
    const spNo = toDec(event.noSpread);
    let buyPrice: number | null = null;
    let pForKelly: number;
    if (position === "yes") {
      const raw = qYes != null ? qYes + spYes : null;
      buyPrice = raw != null ? Math.min(0.99, raw) : null;
      pForKelly = p;
    } else {
      const raw = qNo != null ? qNo + spNo : null;
      buyPrice = raw != null ? Math.min(0.99, raw) : null;
      pForKelly = 1 - p; // P(NO) = 1 - P(YES)
    }

    let kellyCriterion: number | null = null;
    if (buyPrice != null && buyPrice > 0 && buyPrice < 1 && pForKelly > 0 && pForKelly < 1 && c != null && c > 0) {
      kellyCriterion = computeKellyCriterion(pForKelly, buyPrice, c);
    }

    const updateData: Parameters<typeof prisma.screenerEvent.update>[0]["data"] = {
      kellyPosition: position,
      kellyCriterion,
    };
    if (typeof traderAppraisedYes === "number") updateData.traderAppraisedYes = traderAppraisedYes;
    if (typeof kellyC === "number") updateData.kellyC = kellyC;

    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      traderAppraisedYes: p,
      kellyC: c,
      kellyCriterion,
      kellyPosition: position,
      kellyCriterionPercent: kellyCriterion != null ? kellyCriterion * 100 : null,
    });
  } catch (err) {
    console.error("Kelly update error:", err);
    return NextResponse.json(
      { error: "Failed to update Kelly" },
      { status: 500 }
    );
  }
}
