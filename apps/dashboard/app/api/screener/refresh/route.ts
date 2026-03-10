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

    // Process each market directly (child-level); no parent event aggregation
    // Filter: active + closed + end date (API returns ready:false for all; filter after fetch)
    let upserted = 0;
    const filtered = allMarkets.filter((m) => {
      if (m.active !== true || m.closed !== false) return false;
      const raw = (m.endDate ?? m.end_date) ?? null;
      if (!raw) return true; // no end date = include
      const d = new Date(raw);
      return !isNaN(d.getTime()) && d <= endDateMax;
    });
    for (const m of filtered) {
      if (!m?.id) continue;
      const endDate = (m.endDate ?? m.end_date) ? new Date((m.endDate ?? m.end_date) as string) : null;
      const { yes: probYes, no: probNo } = parseProbabilities(m);
      const base = {
        externalId: m.id,
        slug: m.slug ?? m.id,
        title: m.question ?? "",
        description: m.description ?? null,
        image: m.image ?? null,
        icon: m.icon ?? null,
        volume: typeof m.volume === "number" ? m.volume : parseFloat(String(m.volumeNum ?? m.volume ?? 0)) || 0,
        liquidity: typeof m.liquidity === "number" ? m.liquidity : parseFloat(String(m.liquidityNum ?? m.liquidity ?? 0)) || 0,
        endDate,
        active: m.active ?? true,
        closed: m.closed ?? false,
        restricted: m.restricted ?? false,
        probabilityYes: probYes,
        probabilityNo: probNo,
        raw: m as unknown as object,
      };
      await prisma.screenerEvent.upsert({
        where: { externalId: m.id },
        create: base,
        update: { ...base, syncedAt: new Date() },
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
