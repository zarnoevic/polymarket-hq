import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

/** Tag preferences from DB only. Run POST /api/screener/tags/sync to refresh tags from Gamma. */
export async function GET() {
  try {
    const prefs = await prisma.screenerTagPreference.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tag: true },
    });

    return NextResponse.json(
      prefs.map((p) => ({ tagId: p.tagId, label: p.tag.label, slug: p.tag.slug }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : [];

    await prisma.screenerTagPreference.deleteMany({});

    for (let i = 0; i < tagIds.length; i++) {
      const tagId = String(tagIds[i]).trim();
      if (!tagId) continue;
      const tag = await prisma.gammaTag.findUnique({ where: { id: tagId } });
      if (tag) {
        await prisma.screenerTagPreference.create({
          data: { tagId, sortOrder: i },
        });
      }
    }

    const prefs = await prisma.screenerTagPreference.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tag: true },
    });
    return NextResponse.json(
      prefs.map((p) => ({ tagId: p.tagId, label: p.tag.label, slug: p.tag.slug }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
