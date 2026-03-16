import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

/** Soft delete an event by setting deletedAt. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId } = body as { eventId: string };
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

    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true, deletedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Soft delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
