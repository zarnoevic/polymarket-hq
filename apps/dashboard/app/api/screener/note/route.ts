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

    const event = await prisma.screenerEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const value = typeof note === "string" ? note : note === null || note === undefined ? null : String(note);
    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: { note: value || null },
    });

    return NextResponse.json({ ok: true, note: value || null });
  } catch (err) {
    console.error("Note update error:", err);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}
