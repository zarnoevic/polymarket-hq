import { fetchActivity } from "@/lib/polymarket";
import {
  computePositionAverages,
  computeTotalWinChances,
  formatRoi,
} from "@/lib/position-metrics";
import {
  BarChart3,
  Trophy,
  Wallet,
  TrendingUp,
  Layers,
  CircleDollarSign,
  Coins,
  Briefcase,
  ExternalLink,
  Brain,
  Target,
  PiggyBank,
  Percent,
} from "lucide-react";
import { CategorizedPositionsList } from "@/app/components/CategorizedPositionsList";
import { CategoryAttributionPieChart } from "@/app/components/CategoryAttributionPieChart";
import { CategoryCompositionPieChart } from "@/app/components/CategoryCompositionPieChart";
import { CopyAddress } from "@/app/components/CopyAddress";
import { AttributionPieChart } from "@/app/components/AttributionPieChart";

type LeaderboardEntry = {
  rank: string;
  proxyWallet: string;
  userName: string;
  xUsername: string;
  verifiedBadge: boolean;
  vol: number;
  pnl: number;
  profileImage: string;
};

const DEFAULT_WALLET = "0x25012ec798e4861e38c645df919f86dc3c177e28";

// Total traders on Polymarket (for percentile calculation; not displayed)
const TOTAL_TRADERS = 2_361_540;

// Polygon USDC.e (bridged) - 6 decimals
const USDC_E_POLYGON = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174" as const;
const POLYGON_RPCS = [
  process.env.POLYGON_RPC_URL,
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
].filter(Boolean) as string[];

async function fetchUsdcBalance(): Promise<number | null> {
  const wallet =
    process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;
  const addr = wallet.toLowerCase().startsWith("0x")
    ? wallet.slice(2).padStart(64, "0")
    : wallet.padStart(64, "0");
  const data = `0x70a08231${addr}`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: USDC_E_POLYGON.toLowerCase(), data }, "latest"],
  });

  for (const rpc of POLYGON_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        next: { revalidate: 60 },
      });

      if (!res.ok) continue;

      const json = await res.json();
      if (json?.error) continue;

      const hex = json?.result;
      if (typeof hex !== "string") continue;
      if (hex === "0x" || hex === "0x0") return 0;

      const raw = BigInt(hex);
      return Number(raw) / 1e6;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchAccountData(): Promise<LeaderboardEntry | null> {
  const wallet =
    process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;

  try {
    const url = new URL("https://data-api.polymarket.com/v1/leaderboard");
    url.searchParams.set("category", "OVERALL");
    url.searchParams.set("timePeriod", "ALL");
    url.searchParams.set("orderBy", "PNL");
    url.searchParams.set("limit", "25");
    url.searchParams.set("user", wallet);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

type Position = {
  asset: string;
  title: string;
  slug: string;
  icon: string;
  outcome: string;
  oppositeOutcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  endDate: string;
  /** Unix timestamp (seconds) of first BUY for this asset, from activity/trades. */
  entryTimestamp?: number;
  /** Yes token ID for price history - always fetch Yes, not No. */
  yesId?: string;
  /** Ask-bid spread for the outcome token (add to buy price for ROI/PAROI). */
  spread?: number | null;
};

async function fetchTotalValue(): Promise<number | null> {
  const wallet =
    process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;

  try {
    const url = new URL("https://data-api.polymarket.com/value");
    url.searchParams.set("user", wallet);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const entry = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return entry?.value != null ? Number(entry.value) : null;
  } catch {
    return null;
  }
}

async function fetchPositions(): Promise<Position[]> {
  const wallet =
    process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET;

  try {
    const url = new URL("https://data-api.polymarket.com/positions");
    url.searchParams.set("sizeThreshold", "1");
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortBy", "TOKENS");
    url.searchParams.set("sortDirection", "DESC");
    url.searchParams.set("user", wallet);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Map asset -> first BUY timestamp (Unix seconds). */
function buildFirstBuyTimestampMap(activity: Array<{ asset: string; side: string; timestamp: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of activity) {
    if (a.side !== "BUY") continue;
    const cur = map.get(a.asset);
    if (cur == null || a.timestamp < cur) map.set(a.asset, a.timestamp);
  }
  return map;
}

const CLOB_BASE = "https://clob.polymarket.com";

type OrderBookEntry = { price: string; size: string };
type OrderBookResponse = { bids?: OrderBookEntry[]; asks?: OrderBookEntry[] };

/** Fetch ask-bid spread for a token. Returns null on error or missing data. */
async function fetchSpread(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`, {
      next: { revalidate: 60 },
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

/** Resolve Yes token ID. For Yes positions asset=yesId. For No positions, fetch from Gamma. */
async function resolveYesTokenId(asset: string, outcome: string): Promise<string> {
  if (outcome.toLowerCase() === "yes") return asset;
  try {
    const url = `https://gamma-api.polymarket.com/markets?limit=1&clob_token_ids=${encodeURIComponent(asset)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 300 } });
    if (!res.ok) return asset;
    const data = await res.json();
    const m = Array.isArray(data) && data[0] ? data[0] : null;
    const raw = m?.clobTokenIds;
    if (!raw) return asset;
    const ids = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(ids) && ids[0] ? String(ids[0]) : asset;
  } catch {
    return asset;
  }
}

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return formatUsd(value);
}

export default async function HomePage() {
  const [account, positionsRaw, totalValue, deployableCapital, activity] = await Promise.all([
    fetchAccountData(),
    fetchPositions(),
    fetchTotalValue(),
    fetchUsdcBalance(),
    fetchActivity(),
  ]);
  const firstBuyTs = buildFirstBuyTimestampMap(activity);
  const rawPositions = positionsRaw as Position[];
  const [yesIds, spreads] = await Promise.all([
    Promise.all(rawPositions.map((p) => resolveYesTokenId(p.asset, p.outcome))),
    Promise.all(rawPositions.map((p) => fetchSpread(p.asset))),
  ]);
  const positions: Position[] = rawPositions.map((p, i) => ({
    ...p,
    entryTimestamp: firstBuyTs.get(p.asset),
    yesId: yesIds[i],
    spread: spreads[i] ?? null,
  }));

  const { avgParoi, avgCaroi, avgRoi, avgPositionSize, avgProfit, avgBettedChance, avgCurrentChance } =
    computePositionAverages(positions);

  // If all positions resolve in our favor: each pays $1 per share; plus cash
  const positionsSize = positions.reduce((s, p) => s + p.size, 0);
  const totalWinValue = (deployableCapital ?? 0) + positionsSize;

  const portfolioValue = (deployableCapital ?? 0) + (totalValue ?? 0);
  const positionsPct =
    portfolioValue > 0 && totalValue != null
      ? ((totalValue / portfolioValue) * 100)
      : null;
  const totalWinROI =
    portfolioValue > 0
      ? (totalWinValue - portfolioValue) / portfolioValue
      : null;

  const { chanceTotalWin, initialChanceTotalWin } =
    computeTotalWinChances(positions);

  return (
    <div className="bg-[rgb(var(--background-rgb))]">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex w-full pt-4 pb-2">
        {/* Left margin: averages and total win */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 min-w-0">
          {positions.length > 0 && (
            <div className="inline-flex flex-col items-stretch gap-4">
              <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Win
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <Trophy className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">Value</p>
                      <p className="font-semibold text-emerald-400">
                        {formatCompact(totalWinValue)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                      <Layers className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Positions</p>
                      <p className="font-semibold text-white">
                        {positions.length}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                      <Percent className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Positions %</p>
                      <p className="font-semibold text-white">
                        {positionsPct != null
                          ? `${positionsPct.toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total Win ROI</p>
                      <p className="font-semibold text-emerald-400">
                        {totalWinROI != null ? formatRoi(totalWinROI) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Chance of Total Win</p>
                      <p className="font-semibold text-white">
                        {chanceTotalWin != null
                          ? `${(chanceTotalWin * 100).toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Initial Chance of Total Win</p>
                      <p className="font-semibold text-white">
                        {initialChanceTotalWin != null
                          ? `${(initialChanceTotalWin * 100).toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Averages
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                      <Target className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg PROI</p>
                      <p className="font-semibold text-white">
                        {avgParoi != null ? formatRoi(avgParoi) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                      <Target className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg PAROI</p>
                      <p className="font-semibold text-white">
                        {avgParoi != null ? formatRoi(avgParoi) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg Betted Chance</p>
                      <p className="font-semibold text-white">
                        {avgBettedChance != null
                          ? `${(avgBettedChance * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg Current Chance</p>
                      <p className="font-semibold text-white">
                        {avgCurrentChance != null
                          ? `${(avgCurrentChance * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg CROI</p>
                      <p className="font-semibold text-white">
                        {avgRoi != null ? formatRoi(avgRoi) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg CAROI</p>
                      <p className="font-semibold text-white">
                        {avgCaroi != null ? formatRoi(avgCaroi) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg PROI</p>
                      <p className="font-semibold text-white">
                        {avgParoi != null ? formatRoi(avgParoi) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                      <PiggyBank className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg Position Size</p>
                      <p className="font-semibold text-white">
                        {formatCompact(avgPositionSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        avgProfit >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      <Percent className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Avg P&L</p>
                      <p
                        className={`font-semibold ${
                          avgProfit >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {avgProfit >= 0 ? "+" : ""}
                        {formatCompact(avgProfit)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Center: content exactly as before (max-w-5xl centered) */}
        <div className="w-full max-w-5xl shrink-0 px-6">
        {account ? (
          <div className="space-y-6">
            {/* Main account card */}
            <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-xl shadow-black/20 backdrop-blur-sm">
              <div className="border-b border-slate-700/50 px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                        <Wallet className="h-7 w-7" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">
                          <a
                            href={`https://polymarketanalytics.com/traders/${account.proxyWallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-indigo-300 transition-colors"
                          >
                            {account.userName || "Anonymous"}
                          </a>
                        </h2>
                        <p className="mt-0.5 text-sm">
                          <CopyAddress
                            address={account.proxyWallet}
                            href={`https://polygonscan.com/address/${account.proxyWallet}`}
                          />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <a
                        href="https://polymarket.com/portfolio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
                      >
                        Polymarket
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-4 py-2">
                        <Trophy className="h-5 w-5 text-amber-400" />
                        <span className="font-mono text-lg font-bold text-white">
                          #{Number(account.rank).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-4 py-2">
                        <Brain className="h-4 w-4 text-indigo-400" />
                        <span className="flex items-center gap-1.5 text-slate-400">
                          Top {(() => {
                            const pct = (Number(account.rank) / TOTAL_TRADERS) * 100;
                            return pct < 0.01 ? pct.toFixed(4) : pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
                          })()}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
                {/* Portfolio value (deployable + positions) */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-3 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                    <Briefcase className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Portfolio</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCompact(
                        (deployableCapital ?? 0) + (totalValue ?? 0)
                      )}
                    </p>
                  </div>
                </div>

                {/* Deployable capital (Polygon USDC.e) */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-3 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                    <Coins className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Cash</p>
                    <p className="text-2xl font-bold text-white">
                      {deployableCapital != null
                        ? formatCompact(deployableCapital)
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Total value of positions */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-3 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <CircleDollarSign className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Positions</p>
                    <p className="text-2xl font-bold text-white">
                      {totalValue != null
                        ? formatCompact(totalValue)
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* PnL */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-3 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <TrendingUp className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">P&L</p>
                    <p
                      className={`text-2xl font-bold ${
                        account.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {account.pnl >= 0 ? "+" : ""}
                      {formatCompact(account.pnl)}
                    </p>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-4 px-6 py-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                    <BarChart3 className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Volume</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCompact(account.vol)}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {positions.length > 0 && (
              <CategorizedPositionsList
                positions={positions}
                wallet={process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET}
              />
            )}

          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-8 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
              <Wallet className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              No account data found
            </h3>
            <p className="mt-2 text-slate-400">
              Set <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm">POLYMARKET_MAIN_WALLET</code> or ensure the default wallet has leaderboard data.
            </p>
          </div>
        )}
        </div>
        {/* Right margin: Pie charts - allocation, category 24h, positions 24h */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 min-w-0 py-4">
          {positions.length > 0 && (
            <>
              <CategoryCompositionPieChart
                positions={positions}
                wallet={process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET}
              />
              <CategoryAttributionPieChart
                positions={positions}
                wallet={process.env.POLYMARKET_MAIN_WALLET ?? DEFAULT_WALLET}
              />
              <AttributionPieChart positions={positions} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
