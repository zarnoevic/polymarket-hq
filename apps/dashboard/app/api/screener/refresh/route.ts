import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const GAMMA_BASE = "https://gamma-api.polymarket.com/markets";
const CLOB_BASE = "https://clob.polymarket.com";

type OrderBookEntry = { price: string; size: string };
type OrderBookResponse = { bids?: OrderBookEntry[]; asks?: OrderBookEntry[] };

/** Fetch ask-bid spread for a token. Returns null on error or missing data. */
async function fetchSpread(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: OrderBookResponse = await res.json();
    const bids = (data.bids ?? []).map((b) => parseFloat(b.price)).filter((p) => Number.isFinite(p)).sort((a, b) => b - a);
    const asks = (data.asks ?? []).map((a) => parseFloat(a.price)).filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
    const bestAsk = asks[0] ?? 0;
    const bestBid = bids[0] ?? 0;
    if (bestAsk > 0 && bestBid > 0) return bestAsk - bestBid;
    return null;
  } catch {
    return null;
  }
}
const PAGE_LIMIT = 100;
const TAGS_CONCURRENCY = 5;
const TAGS_RETRIES = 3;
const TAGS_RETRY_DELAY_MS = 500;

type GammaTag = {
  id?: string;
  label?: string;
  slug?: string;
  [k: string]: unknown;
};

async function fetchTagsForMarket(marketId: string): Promise<GammaTag[]> {
  for (let attempt = 1; attempt <= TAGS_RETRIES; attempt++) {
    try {
      const res = await fetch(`${GAMMA_BASE}/${marketId}/tags`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      // Retry on rate limit or server errors
      if ((res.status === 429 || res.status >= 500) && attempt < TAGS_RETRIES) {
        await new Promise((r) => setTimeout(r, TAGS_RETRY_DELAY_MS * attempt));
        continue;
      }
      return [];
    } catch {
      if (attempt < TAGS_RETRIES) {
        await new Promise((r) => setTimeout(r, TAGS_RETRY_DELAY_MS * attempt));
      } else {
        return [];
      }
    }
  }
  return [];
}

/** Fetch tags for multiple markets in parallel with concurrency limit */
async function fetchTagsBatch(
  marketIds: string[],
  concurrency: number
): Promise<Map<string, GammaTag[]>> {
  const result = new Map<string, GammaTag[]>();
  const uniqueIds = [...new Set(marketIds.filter(Boolean))];

  for (let i = 0; i < uniqueIds.length; i += concurrency) {
    const batch = uniqueIds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const tags = await fetchTagsForMarket(id);
        return { id, tags };
      })
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        result.set(s.value.id, s.value.tags);
      }
    }
    // Small delay between batches to reduce rate-limit risk
    if (i + concurrency < uniqueIds.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return result;
}

/** Days until resolution; null if endDate missing or in the past. */
function daysToResolution(endDate: Date | null): number | null {
  if (!endDate) return null;
  const d = endDate instanceof Date ? endDate : new Date(endDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const resUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((resUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return days > 0 ? Math.max(1, days) : null;
}

/** Numeric PAROI: r = (1-P)/P, annualized = r * (365/days). Returns null if invalid. */
function computeParoiNumeric(curPrice: number | null, days: number | null): number | null {
  if (curPrice == null || curPrice > 1 || curPrice <= 0 || curPrice < 1e-9 || !Number.isFinite(curPrice))
    return null;
  const r = (1 - curPrice) / curPrice;
  return days == null || days <= 0 ? r : r * (365 / days);
}

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
  clobTokenIds?: string | string[];
  [k: string]: unknown;
};

function parseClobTokenIds(m: GammaMarket): { yesId: string | null; noId: string | null } {
  try {
    const raw = m.clobTokenIds;
    if (!raw) return { yesId: null, noId: null };
    const ids = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(ids) || ids.length < 2) return { yesId: null, noId: null };
    const y = String(ids[0]).trim();
    const n = String(ids[1]).trim();
    return { yesId: y || null, noId: n || null };
  } catch {
    return { yesId: null, noId: null };
  }
}

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

const SCREENER_TAG_IDS = ["100265", "1628"];

/** Fetch all markets for a given tag_id (paginated). */
async function fetchMarketsForTag(tagId: string): Promise<GammaMarket[]> {
  const out: GammaMarket[] = [];
  let offset = 0;
  const MAX_PAGES = 200;
  const params = `tag_id=${tagId}&closed=false`;

  for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
    const url = `${GAMMA_BASE}?${params}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Gamma API returned ${res.status}`);
    const markets: GammaMarket[] = await res.json();
    if (!Array.isArray(markets)) throw new Error("Invalid API response: expected array");
    out.push(...markets);
    if (markets.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return out;
}

export async function POST() {
  const startedAt = new Date();

  try {
    const tagResults = await Promise.all(
      SCREENER_TAG_IDS.map((tagId) => fetchMarketsForTag(tagId))
    );
    const byId = new Map<string, GammaMarket>();
    for (const markets of tagResults) {
      for (const m of markets) {
        if (m?.id && !byId.has(m.id)) byId.set(m.id, m);
      }
    }
    const allMarkets = Array.from(byId.values());

    const endDateMax = getEndDateMax();
    const endDateMin = new Date();
    endDateMin.setUTCHours(0, 0, 0, 0);

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

    // Fetch tags for all filtered markets (parallel with concurrency limit)
    const tagsByMarketId = await fetchTagsBatch(
      filtered.map((m) => m.id).filter(Boolean),
      TAGS_CONCURRENCY
    );

    for (const m of filtered) {
      if (!m?.id) continue;
      const endDate = (m.endDate ?? m.end_date) ? new Date((m.endDate ?? m.end_date) as string) : null;
      const createdAt = m.createdAt ? new Date(m.createdAt) : null;
      const { yes: probYes, no: probNo } = parseProbabilities(m);
      const { yesId, noId } = parseClobTokenIds(m);
      const [yesSpread, noSpread] = await Promise.all([
        yesId ? fetchSpread(yesId) : Promise.resolve(null),
        noId ? fetchSpread(noId) : Promise.resolve(null),
      ]);
      const parentEventSlug = m.events?.[0]?.slug ?? null;
      // Category status: under_5 if yes or no < 5% (low priority), else discovery (null)
      const isUnder5 = (probYes != null && probYes < 0.05) || (probNo != null && probNo < 0.05);
      const tags = tagsByMarketId.get(m.id) ?? [];
      const days = daysToResolution(endDate);
      const yesParoi = computeParoiNumeric(probYes ?? (probNo != null ? 1 - probNo : null), days);
      const noParoi = computeParoiNumeric(probNo ?? (probYes != null ? 1 - probYes : null), days);
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
        tags: tags.length > 0 ? (tags as object) : null,
        yesParoi,
        noParoi,
        yesId,
        noId,
        yesSpread,
        noSpread,
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
          tags: tags.length > 0 ? (tags as object) : null,
          yesParoi,
          noParoi,
          yesId,
          noId,
          yesSpread,
          noSpread,
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
