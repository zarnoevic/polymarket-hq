import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

const GAMMA_BASE = "https://gamma-api.polymarket.com/markets";
const GAMMA_EVENTS = "https://gamma-api.polymarket.com/events";
const CLOB_BASE = "https://clob.polymarket.com";

type OrderBookEntry = { price: string; size: string };
type OrderBookResponse = { bids?: OrderBookEntry[]; asks?: OrderBookEntry[] };

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

type GammaTag = { id?: string; label?: string; slug?: string; [k: string]: unknown };

async function fetchTagsForMarket(marketId: string): Promise<GammaTag[]> {
  try {
    const res = await fetch(`${GAMMA_BASE}/${marketId}/tags`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {
    // ignore
  }
  return [];
}

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

function computeParoiNumeric(curPrice: number | null, days: number | null): number | null {
  if (curPrice == null || curPrice > 1 || curPrice <= 0 || curPrice < 1e-9 || !Number.isFinite(curPrice))
    return null;
  const r = (1 - curPrice) / curPrice;
  return days == null || days <= 0 ? r : r * (365 / days);
}

function getEndDateMax(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  d.setHours(23, 59, 59, 999);
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

/** Fetch markets by slug. Tries market slug first, then event slug. */
async function fetchMarketsBySlug(slug: string): Promise<GammaMarket[]> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return [];

  // 1. Try markets API by slug (market slug)
  const marketsRes = await fetch(
    `${GAMMA_BASE}?slug=${encodeURIComponent(trimmed)}&limit=20&closed=false`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (marketsRes.ok) {
    const data: GammaMarket[] = await marketsRes.json();
    if (Array.isArray(data) && data.length > 0) return data;
  }

  // 2. Try events API by slug (event slug) - event has markets array
  const eventsRes = await fetch(
    `${GAMMA_EVENTS}?slug=${encodeURIComponent(trimmed)}&closed=false`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (eventsRes.ok) {
    const events: Array<{ markets?: GammaMarket[] }> = await eventsRes.json();
    if (Array.isArray(events) && events.length > 0) {
      const all: GammaMarket[] = [];
      for (const ev of events) {
        if (ev?.markets && Array.isArray(ev.markets)) all.push(...ev.markets);
      }
      if (all.length > 0) return all;
    }
  }

  return [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const slug = typeof body?.slug === "string" ? body.slug : null;
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const allMarkets = await fetchMarketsBySlug(slug);
    if (allMarkets.length === 0) {
      return NextResponse.json(
        { error: `No market or event found for slug: ${slug}` },
        { status: 404 }
      );
    }

    const endDateMax = getEndDateMax();
    const endDateMin = new Date();
    endDateMin.setUTCHours(0, 0, 0, 0);

    const filtered = allMarkets.filter((m) => {
      if (m.active !== true || m.closed !== false) return false;
      const raw = (m.endDate ?? m.end_date) ?? null;
      if (!raw) return false;
      const d = new Date(raw);
      return !isNaN(d.getTime()) && d >= endDateMin && d <= endDateMax;
    });

    if (filtered.length === 0) {
      return NextResponse.json(
        { error: "No active markets with valid end date found for this slug" },
        { status: 404 }
      );
    }

    const existingExternalIds = filtered.map((m) => m.id).filter(Boolean);
    const existingEvents = await prisma.screenerEvent.findMany({
      where: { externalId: { in: existingExternalIds } },
      select: { externalId: true, label: true },
    });
    const existingLabelByExternalId = new Map(
      existingEvents.map((e) => [e.externalId, e.label])
    );

    let upserted = 0;
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
      const volumeNum = typeof m.volume === "number" ? m.volume : parseFloat(String(m.volumeNum ?? m.volume ?? 0)) || 0;
      const isUnder10 = (probYes != null && probYes <= 0.1) || (probNo != null && probNo <= 0.1);
      const isUnder2kVol = volumeNum < 2_000;
      const statusLabel = isUnder10 ? "under_10" : isUnder2kVol ? "under_2k_vol" : null;
      const tags = await fetchTagsForMarket(m.id);
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
        volume: volumeNum,
        liquidity: typeof m.liquidity === "number" ? m.liquidity : parseFloat(String(m.liquidityNum ?? m.liquidity ?? 0)) || 0,
        endDate,
        createdAt,
        active: m.active ?? true,
        closed: m.closed ?? false,
        restricted: m.restricted ?? false,
        probabilityYes: probYes,
        probabilityNo: probNo,
        raw: m as unknown as object,
        label: statusLabel,
        tags: tags.length > 0 ? (tags as object) : null,
        yesParoi,
        noParoi,
        yesId,
        noId,
        yesSpread,
        noSpread,
      };

      const currentLabel = existingLabelByExternalId.get(m.id);
      const isStatusCategory =
        currentLabel === null ||
        currentLabel === "under_5" ||
        currentLabel === "under_10" ||
        currentLabel === "under_2k_vol";

      await prisma.screenerEvent.upsert({
        where: { externalId: m.id },
        create: base,
        update: {
          probabilityYes: probYes,
          probabilityNo: probNo,
          volume: volumeNum,
          syncedAt: new Date(),
          tags: tags.length > 0 ? (tags as object) : null,
          yesParoi,
          noParoi,
          yesId,
          noId,
          yesSpread,
          noSpread,
          ...(isStatusCategory && { label: statusLabel }),
        },
      });
      upserted++;
    }

    return NextResponse.json({
      ok: true,
      count: upserted,
      slug: slug.trim(),
      titles: filtered.map((m) => m.question ?? m.slug ?? m.id),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
