import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const LABELS = ["vetted", "unknowable", "well_priced", "traded", "evaluating"] as const;
type Label = (typeof LABELS)[number] | null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId, label } = body as {
      eventId: string;
      label?: Label;
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

    const value =
      label !== undefined
        ? label
        : event.label === "vetted"
          ? null
          : "vetted";
    if (value !== null && !LABELS.includes(value as (typeof LABELS)[number])) {
      return NextResponse.json(
        { error: `label must be one of: ${LABELS.join(", ")}, or null` },
        { status: 400 }
      );
    }
    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: { label: value },
    });

    return NextResponse.json({ ok: true, label: value });
  } catch (err) {
    console.error("Label update error:", err);
    return NextResponse.json(
      { error: "Failed to update label" },
      { status: 500 }
    );
  }
}
