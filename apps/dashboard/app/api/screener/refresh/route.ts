import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const GAMMA_BASE = "https://gamma-api.polymarket.com/markets";
const PAGE_LIMIT = 100;

function getEndDateMax(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  d.setHours(23, 59, 59, 999); // End of day
  return d;
}

type GammaMarket = {
  id: string;
  question?: string;
  slug?: string;
  description?: string;
  image?: string;
  icon?: string;
  endDate?: string;
  end_date?: string;
  createdAt?: string;
  volume?: number;
  volumeNum?: number;
  liquidity?: number;
  liquidityNum?: number;
  active?: boolean;
  closed?: boolean;
  ready?: boolean;
  restricted?: boolean;
  outcomePrices?: string | string[];
  outcomes?: string | string[];
  events?: Array<{ slug?: string }>;
  [k: string]: unknown;
};

function parseProbabilities(m: GammaMarket): { yes: number | null; no: number | null } {
  try {
    const pricesRaw = m.outcomePrices;
    const outcomesRaw = m.outcomes;
    if (!pricesRaw || !outcomesRaw) return { yes: null, no: null };
    const prices = typeof pricesRaw === "string" ? JSON.parse(pricesRaw) : pricesRaw;
    const outcomes = typeof outcomesRaw === "string" ? JSON.parse(outcomesRaw) : outcomesRaw;
    if (!Array.isArray(prices) || !Array.isArray(outcomes) || prices.length < 2) return { yes: null, no: null };
    const yesIdx = outcomes.indexOf("Yes");
    const noIdx = outcomes.indexOf("No");
    const yes = yesIdx >= 0 ? parseFloat(String(prices[yesIdx])) : parseFloat(String(prices[0]));
    const no = noIdx >= 0 ? parseFloat(String(prices[noIdx])) : parseFloat(String(prices[1]));
    return { yes: isNaN(yes) ? null : yes, no: isNaN(no) ? null : no };
  } catch {
    return { yes: null, no: null };
  }
}

export async function POST() {
  const startedAt = new Date();

  try {
    const allMarkets: GammaMarket[] = [];
    let offset = 0;
    let hasMore = true;
    const MAX_PAGES = 200; // safety: max 20k markets
    let pageNum = 0;

    const endDateMax = getEndDateMax();
    const endDateMin = new Date();
    endDateMin.setUTCHours(0, 0, 0, 0);
    const gammaParams = `tag_id=100265&closed=false`;

    while (hasMore && pageNum < MAX_PAGES) {
      pageNum++;
      const url = `${GAMMA_BASE}?${gammaParams}&limit=${PAGE_LIMIT}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Gamma API returned ${res.status}`);
      }

      const markets: GammaMarket[] = await res.json();
      if (!Array.isArray(markets)) {
        throw new Error("Invalid API response: expected array");
      }

      allMarkets.push(...markets);
      hasMore = markets.length >= PAGE_LIMIT;
      offset += PAGE_LIMIT;
    }

    // Delete past events from DB so they don't linger
    await prisma.screenerEvent.deleteMany({
      where: { endDate: { lt: endDateMin } },
    });

    // Process each market directly (child-level); no parent event aggregation
    // Filter: active + closed + end date (API returns ready:false for all; filter after fetch)
    let upserted = 0;
    const filtered = allMarkets.filter((m) => {
      if (m.active !== true || m.closed !== false) return false;
      const raw = (m.endDate ?? m.end_date) ?? null;
      if (!raw) return false; // no end date = exclude (can't verify it's not past)
      const d = new Date(raw);
      return !isNaN(d.getTime()) && d >= endDateMin && d <= endDateMax;
    });

    // Fetch existing labels so we can reclassify under_5/discovery when updating probabilities
    const existingExternalIds = filtered.map((m) => m.id).filter(Boolean);
    const existingEvents = await prisma.screenerEvent.findMany({
      where: { externalId: { in: existingExternalIds } },
      select: { externalId: true, label: true },
    });
    const existingLabelByExternalId = new Map(
      existingEvents.map((e) => [e.externalId, e.label])
    );

    for (const m of filtered) {
      if (!m?.id) continue;
      const endDate = (m.endDate ?? m.end_date) ? new Date((m.endDate ?? m.end_date) as string) : null;
      const createdAt = m.createdAt ? new Date(m.createdAt) : null;
      const { yes: probYes, no: probNo } = parseProbabilities(m);
      const parentEventSlug = m.events?.[0]?.slug ?? null;
      // Category status: under_5 if yes or no < 5% (low priority), else discovery (null)
      const isUnder5 = (probYes != null && probYes < 0.05) || (probNo != null && probNo < 0.05);
      const base = {
        externalId: m.id,
        slug: m.slug ?? m.id,
        parentEventSlug: parentEventSlug && parentEventSlug !== (m.slug ?? m.id) ? parentEventSlug : null,
        title: m.question ?? "",
        description: m.description ?? null,
        image: m.image ?? null,
        icon: m.icon ?? null,
        volume: typeof m.volume === "number" ? m.volume : parseFloat(String(m.volumeNum ?? m.volume ?? 0)) || 0,
        liquidity: typeof m.liquidity === "number" ? m.liquidity : parseFloat(String(m.liquidityNum ?? m.liquidity ?? 0)) || 0,
        endDate,
        createdAt,
        active: m.active ?? true,
        closed: m.closed ?? false,
        restricted: m.restricted ?? false,
        probabilityYes: probYes,
        probabilityNo: probNo,
        raw: m as unknown as object,
        label: isUnder5 ? "under_5" : null,
      };
      const currentLabel = existingLabelByExternalId.get(m.id);
      const isStatusCategory = currentLabel === null || currentLabel === "under_5";

      await prisma.screenerEvent.upsert({
        where: { externalId: m.id },
        create: base,
        // For existing: update probabilities + reclassify under_5/discovery when new prob < 5%
        update: {
          probabilityYes: probYes,
          probabilityNo: probNo,
          syncedAt: new Date(),
          ...(isStatusCategory && { label: isUnder5 ? "under_5" : null }),
        },
      });
      upserted++;
    }

    await prisma.syncLog.create({
      data: {
        source: "gamma-screener",
        status: "success",
        recordCount: upserted,
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      count: upserted,
      marketsFetched: allMarkets.length,
      filteredCount: filtered.length,
      pagesFetched: Math.ceil(allMarkets.length / PAGE_LIMIT) || 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.syncLog
      .create({
        data: {
          source: "gamma-screener",
          status: "failed",
          error: msg,
          startedAt,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
