import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const GAMMA_TAGS_URL = "https://gamma-api.polymarket.com/tags";
const PAGE_LIMIT = 100;

type GammaTagResponse = {
  id: string;
  label: string;
  slug: string;
  requiresTranslation?: boolean;
};

/** Fetch ALL tags from Gamma API (paginated) and upsert to DB. */
export async function POST() {
  try {
    const all: GammaTagResponse[] = [];
    let offset = 0;
    for (;;) {
      const url = `${GAMMA_TAGS_URL}?limit=${PAGE_LIMIT}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Gamma API returned ${res.status}`);
      const data: GammaTagResponse[] = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid API response: expected array");
      all.push(...data);
      if (data.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    let upserted = 0;
    for (const t of all) {
      if (!t?.id || typeof t.id !== "string") continue;
      await prisma.gammaTag.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          label: t.label ?? t.id,
          slug: t.slug ?? t.id,
          requiresTranslation: t.requiresTranslation ?? false,
        },
        update: {
          label: t.label ?? t.id,
          slug: t.slug ?? t.id,
          requiresTranslation: t.requiresTranslation ?? false,
        },
      });
      upserted++;
    }

    // Seed default preferences if empty
    const prefCount = await prisma.screenerTagPreference.count();
    if (prefCount === 0) {
      const DEFAULT_TAG_IDS = ["100265", "1628"];
      for (let i = 0; i < DEFAULT_TAG_IDS.length; i++) {
        const tagId = DEFAULT_TAG_IDS[i];
        const exists = await prisma.gammaTag.findUnique({ where: { id: tagId } });
        if (exists) {
          await prisma.screenerTagPreference.create({
            data: { tagId, sortOrder: i },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, count: upserted, total: all.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
