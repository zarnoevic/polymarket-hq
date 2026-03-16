#!/usr/bin/env node
/**
 * Sync all tags from Gamma API to DB.
 * Run from repo root: pnpm sync-tags
 * Requires DATABASE_URL in .env (loaded from apps/dashboard/.env or root .env)
 */
import { config } from "dotenv";
import { resolve } from "path";

config();
if (!process.env.DATABASE_URL?.trim()) {
  config({ path: resolve(process.cwd(), "apps/dashboard/.env") });
}

const GAMMA_TAGS_URL = "https://gamma-api.polymarket.com/tags";
const PAGE_LIMIT = 100;
const DEFAULT_TAG_IDS = ["100265", "1628"];

type GammaTagResponse = {
  id: string;
  label?: string;
  slug?: string;
  requiresTranslation?: boolean;
};

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required. Set it in .env or apps/dashboard/.env");
    process.exit(1);
  }

  const { prisma } = await import("@polymarket-hq/dashboard-prisma");

  try {
    console.log("Fetching tags from Gamma API...");
    const all: GammaTagResponse[] = [];
    let offset = 0;
    for (;;) {
      const url = `${GAMMA_TAGS_URL}?limit=${PAGE_LIMIT}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Gamma API returned ${res.status}`);
      }
      const data = (await res.json()) as GammaTagResponse[];
      if (!Array.isArray(data)) {
        throw new Error("Invalid API response: expected array");
      }
      all.push(...data);
      if (data.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

  console.log(`Upserting ${all.length} tags...`);
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

  const prefCount = await prisma.screenerTagPreference.count();
  if (prefCount === 0) {
    console.log("Seeding default tag preferences (100265, 1628)...");
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

    console.log(`Done. Upserted ${upserted} tags, total ${all.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
