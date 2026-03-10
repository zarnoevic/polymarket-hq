import {
  BarChart3,
  Trophy,
  Wallet,
  TrendingUp,
  Hash,
  Layers,
  Calendar,
  CircleDollarSign,
  Coins,
  Briefcase,
} from "lucide-react";

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

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatUsd(value);
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function HomePage() {
  const [account, positions, totalValue, deployableCapital] = await Promise.all([
    fetchAccountData(),
    fetchPositions(),
    fetchTotalValue(),
    fetchUsdcBalance(),
  ]);

  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-slate-400">
            Account overview and current positions
          </p>
        </header>

        {account ? (
          <div className="space-y-6">
            {/* Main account card */}
            <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-xl shadow-black/20 backdrop-blur-sm">
              <div className="border-b border-slate-700/50 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                      <Wallet className="h-7 w-7" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {account.userName || "Anonymous"}
                      </h2>
                      <p className="mt-0.5 font-mono text-sm text-slate-500">
                        {shortAddress(account.proxyWallet)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-4 py-2">
                    <Trophy className="h-5 w-5 text-amber-400" />
                    <span className="font-semibold text-slate-300">Rank</span>
                    <span className="font-mono text-lg font-bold text-white">
                      #{Number(account.rank).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
                {/* Portfolio value (deployable + positions) */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-6 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                    <Briefcase className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Portfolio Value</p>
                    <p className="text-2xl font-bold text-white">
                      {formatUsd(
                        (deployableCapital ?? 0) + (totalValue ?? 0),
                        2
                      )}
                    </p>
                    <p className="text-xs text-slate-500">USDC.e + positions</p>
                  </div>
                </div>

                {/* Deployable capital (Polygon USDC.e) */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-6 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                    <Coins className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Deployable Capital</p>
                    <p className="text-2xl font-bold text-white">
                      {deployableCapital != null
                        ? formatUsd(deployableCapital, 2)
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-500">Polygon USDC.e</p>
                  </div>
                </div>

                {/* Total value of positions */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-6 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <CircleDollarSign className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Position Value</p>
                    <p className="text-2xl font-bold text-white">
                      {totalValue != null
                        ? formatUsd(totalValue, 2)
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* PnL */}
                <div className="flex items-center gap-4 border-b border-slate-700/50 px-6 py-6 sm:border-b-0 sm:border-r sm:border-slate-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <TrendingUp className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Profit & Loss</p>
                    <p
                      className={`text-2xl font-bold ${
                        account.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {account.pnl >= 0 ? "+" : ""}
                      {formatUsd(account.pnl)}
                    </p>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-4 px-6 py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                    <BarChart3 className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Volume (All Time)</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCompact(account.vol)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rank badge footer */}
              <div className="flex items-center gap-2 border-t border-slate-700/50 px-6 py-3">
                <Hash className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-500">
                  Overall leaderboard · PnL ranking · All time
                </span>
              </div>
            </div>

            {/* Positions */}
            {positions.length > 0 && (
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  Current positions ({positions.length})
                </h2>
                <div className="space-y-4">
                  {positions.map((pos) => (
                    <div
                      key={pos.asset}
                      className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-lg backdrop-blur-sm"
                    >
                      <div className="flex gap-4 p-5">
                        <img
                          src={pos.icon}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-white">{pos.title}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-2 py-0.5 font-medium text-indigo-400">
                              {pos.outcome}
                            </span>
                            {pos.endDate && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <Calendar className="h-3.5 w-3.5" />
                                {pos.endDate}
                              </span>
                            )}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-slate-500">Size</p>
                              <p className="font-mono text-sm font-medium text-white">
                                {pos.size.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                @ {pos.avgPrice.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Current</p>
                              <p className="font-mono text-sm font-medium text-white">
                                {formatUsd(pos.currentValue, 2)} ({pos.curPrice.toFixed(2)}¢)
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Cost</p>
                              <p className="font-mono text-sm text-slate-300">
                                {formatUsd(pos.initialValue, 2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">PnL</p>
                              <p
                                className={`font-mono text-sm font-semibold ${
                                  pos.cashPnl >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }`}
                              >
                                {pos.cashPnl >= 0 ? "+" : ""}
                                {formatUsd(pos.cashPnl, 2)} ({formatPercent(pos.percentPnl)})
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
    </div>
  );
}
