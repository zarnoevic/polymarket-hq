import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId, note } = body as {
      eventId: string;
      note?: string | null;
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

    const value = typeof note === "string" ? note : note === null || note === undefined ? null : String(note);
    const now = new Date();
    const updated = await prisma.screenerEvent.update({
      where: { id: eventId },
      data: { note: value || null, noteUpdatedAt: now },
    });

    return NextResponse.json({ ok: true, note: value || null, noteUpdatedAt: updated.noteUpdatedAt?.toISOString() ?? now.toISOString() });
  } catch (err) {
    console.error("Note update error:", err);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}
