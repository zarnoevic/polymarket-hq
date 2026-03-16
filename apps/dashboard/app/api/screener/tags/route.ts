import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

/** GET tags from DB only. Search by q (label, slug, id). No Gamma API calls. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const tags = await prisma.gammaTag.findMany({
      orderBy: { label: "asc" },
    });

    if (!q) {
      return NextResponse.json(tags);
    }

    // Search: all space-separated tokens must appear in label, slug, or id (order-independent)
    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const filtered = tags.filter((t) => {
      const searchable = `${(t.label ?? "").toLowerCase()} ${(t.slug ?? "").toLowerCase()} ${t.id}`;
      return tokens.every((token) => searchable.includes(token));
    });

    return NextResponse.json(filtered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
