import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

/** Excluded tag preferences from DB. Markets with these tags are skipped during refresh. */
export async function GET() {
  try {
    const prefs = await prisma.screenerTagExclusion.findMany({
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

    await prisma.screenerTagExclusion.deleteMany({});

    for (let i = 0; i < tagIds.length; i++) {
      const tagId = String(tagIds[i]).trim();
      if (!tagId) continue;
      const tag = await prisma.gammaTag.findUnique({ where: { id: tagId } });
      if (tag) {
        await prisma.screenerTagExclusion.create({
          data: { tagId, sortOrder: i },
        });
      }
    }

    const prefs = await prisma.screenerTagExclusion.findMany({
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
