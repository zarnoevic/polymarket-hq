import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const DEFAULT_TAG_IDS = ["100265", "1628"];
const GAMMA_TAGS_URL = "https://gamma-api.polymarket.com/tags";

export async function GET() {
  try {
    let prefs = await prisma.screenerTagPreference.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tag: true },
    });

    if (prefs.length === 0) {
      // Sync tags from Gamma if gamma_tags is empty
      const tagCount = await prisma.gammaTag.count();
      if (tagCount === 0) {
        const res = await fetch(GAMMA_TAGS_URL, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as Array<{ id?: string; label?: string; slug?: string }>;
          if (Array.isArray(data)) {
            for (const t of data) {
              if (t?.id) {
                await prisma.gammaTag.upsert({
                  where: { id: t.id },
                  create: { id: t.id, label: t.label ?? t.id, slug: t.slug ?? t.id, requiresTranslation: false },
                  update: { label: t.label ?? t.id, slug: t.slug ?? t.id },
                });
              }
            }
          }
        }
      }
      // Seed defaults
      for (let i = 0; i < DEFAULT_TAG_IDS.length; i++) {
        const tagId = DEFAULT_TAG_IDS[i];
        const tag = await prisma.gammaTag.findUnique({ where: { id: tagId } });
        if (tag) {
          await prisma.screenerTagPreference.create({
            data: { tagId, sortOrder: i },
          });
        }
      }
      const after = await prisma.screenerTagPreference.findMany({
        orderBy: { sortOrder: "asc" },
        include: { tag: true },
      });
      return NextResponse.json(
        after.map((p) => ({ tagId: p.tagId, label: p.tag.label, slug: p.tag.slug }))
      );
    }

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
