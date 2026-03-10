"use client";

import { useState } from "react";
import { RefreshCw, Filter, Calendar, BarChart3, ExternalLink, Loader2, Search, RotateCw, Sparkles, FileText, X, Brain } from "lucide-react";
import { toast } from "sonner";

type ScreenerEvent = {
  id: string;
  externalId: string;
  slug: string;
  parentEventSlug: string | null;
  title: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  volume: number;
  liquidity: number;
  endDate: Date | null;
  active: boolean;
  closed: boolean;
  restricted: boolean;
  probabilityYes: number | null;
  probabilityNo: number | null;
  appraisedYes: number | null;
  appraisedNo: number | null;
  lastAppraised: Date | null;
  yev: number | null;
  nev: number | null;
  appraisalExplanation: string | null;
  syncedAt: Date;
};

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatUsd(value);
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ExplanationModal({
  explanation,
  title,
  onClose,
}: {
  explanation: string;
  title: string;
  onClose: () => void;
}) {
  const parts = explanation.split(/(https?:\/\/[^\s]+)/g);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-6 py-4">
          <h3 className="font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {parts.map((part, i) =>
              part.match(/^https?:\/\//) ? (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline hover:text-indigo-300"
                >
                  {part}
                </a>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenerContent({
  initialEvents,
}: {
  initialEvents: ScreenerEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [refreshing, setRefreshing] = useState(false);
  const [appraising, setAppraising] = useState<string | null>(null);
  const [explanationEventId, setExplanationEventId] = useState<string | null>(null);

  async function handleAppraise(eventId: string, mode: "deep" | "mini" | "reappraise" | "think") {
    setAppraising(eventId);
    const labels = { deep: "Running deep research…", mini: "Running mini research…", reappraise: "Checking for new news…", think: "Extended thinking (GPT‑5)…" };
    toast.info(labels[mode]);
    try {
      const res = await fetch("/api/screener/appraise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Appraise failed");
      const successLabels = { deep: "Deep appraisal complete", mini: "Mini appraisal complete", reappraise: "Reappraisal complete", think: "Think appraisal complete" };
      toast.success(successLabels[mode]);
      const listRes = await fetch("/api/screener/events");
      const list = await listRes.json();
      if (Array.isArray(list)) setEvents(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Appraise failed";
      toast.error(msg);
    } finally {
      setAppraising(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    toast.info("Fetching events from Gamma API…");
    try {
      const res = await fetch("/api/screener/refresh", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Refresh failed");
      }

      toast.success(`Synced ${data.count} events to database`);
      const listRes = await fetch("/api/screener/events");
      const list = await listRes.json();
      if (Array.isArray(list)) setEvents(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refresh failed";
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Screener
            </h1>
            <p className="mt-1 text-slate-400">
              Events from Gamma API (tag_id=100265) · closed=false · end_date within today–3 months
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-8 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
            <Filter className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            No events yet
          </h3>
          <p className="mt-2 text-slate-400">
            Click <strong>Refresh</strong> to fetch events from the Gamma API and store them in the database.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BarChart3 className="h-4 w-4" />
            <span>{events.length} markets · appraised first, then quoted closest to 50%</span>
          </div>

          <div className="space-y-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-lg backdrop-blur-sm transition-colors hover:border-slate-700/60"
              >
                <div className="flex gap-4 p-5">
                  {(e.image ?? e.icon) && (
                    <img
                      src={e.image ?? e.icon ?? ""}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white">{e.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-mono text-slate-500">{e.slug}</span>
                      {e.endDate && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(e.endDate)}
                        </span>
                      )}
                      {e.restricted && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-400">
                          Restricted
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-6">
                      <div>
                        <p className="text-xs text-slate-500">Volume</p>
                        <p className="font-mono font-medium text-white">
                          {formatCompact(e.volume)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Liquidity</p>
                        <p className="font-mono font-medium text-slate-300">
                          {formatCompact(e.liquidity)}
                        </p>
                      </div>
                      {(e.probabilityYes != null || e.probabilityNo != null) && (
                        <div className="min-w-[160px] flex flex-col gap-3">
                          <div>
                            <p className="text-[11px] text-slate-500 mb-1">Quoted</p>
                            <div className="flex justify-between gap-4 text-xs font-medium mb-1.5">
                              <span className="text-emerald-600/90 tabular-nums">Yes {((e.probabilityYes ?? 0) * 100).toFixed(0)}%</span>
                              <span className="text-red-600/90 tabular-nums">No {((e.probabilityNo ?? 0) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-800/80 ring-1 ring-slate-700/80">
                              <div
                                className="rounded-l-full min-w-0 bg-emerald-600/70"
                                style={{ width: `${(e.probabilityYes ?? 0) * 100}%` }}
                              />
                              <div
                                className="rounded-r-full min-w-0 bg-red-600/70"
                                style={{ width: `${(e.probabilityNo ?? 0) * 100}%` }}
                              />
                            </div>
                          </div>
                          {(e.appraisedYes != null || e.appraisedNo != null) && (
                            <div>
                              <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-800/80 ring-1 ring-slate-700/80">
                                <div
                                  className="rounded-l-full min-w-0 bg-emerald-600/70"
                                  style={{ width: `${(e.appraisedYes ?? 0) * 100}%` }}
                                />
                                <div
                                  className="rounded-r-full min-w-0 bg-red-600/70"
                                  style={{ width: `${(e.appraisedNo ?? 0) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between gap-4 text-xs font-medium mt-1.5">
                                <span className="text-emerald-600/90 tabular-nums">Yes {((e.appraisedYes ?? 0) * 100).toFixed(1)}%</span>
                                <span className="text-red-600/90 tabular-nums">No {((e.appraisedNo ?? 0) * 100).toFixed(1)}%</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">Appraised</p>
                            </div>
                          )}
                        </div>
                      )}
                      {(e.yev != null || e.nev != null) && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">YEV</span>
                          <span className="font-mono text-sm text-emerald-500/90">{(e.yev ?? 0).toFixed(2)}</span>
                          <span className="text-xs text-slate-500">NEV</span>
                          <span className="font-mono text-sm text-red-500/90">{(e.nev ?? 0).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleAppraise(e.id, "deep")}
                        disabled={!!appraising}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50"
                      >
                        {appraising === e.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Search className="h-3 w-3" />
                        )}
                        Deep Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "think")}
                        disabled={!!appraising}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
                      >
                        {appraising === e.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Brain className="h-3 w-3" />
                        )}
                        Think Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "mini")}
                        disabled={!!appraising}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50"
                      >
                        {appraising === e.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Mini Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "reappraise")}
                        disabled={!!appraising || e.lastAppraised == null}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {appraising === e.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        Reappraise
                      </button>
                      {e.appraisalExplanation && (
                        <button
                          onClick={() => setExplanationEventId(e.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60"
                        >
                          <FileText className="h-3 w-3" />
                          View explanation
                        </button>
                      )}
                    </div>
                    <a
                      href={`https://polymarket.com/event/${e.parentEventSlug ?? e.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      View on Polymarket
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {explanationEventId && (() => {
        const ev = events.find((x) => x.id === explanationEventId);
        if (!ev?.appraisalExplanation) return null;
        return (
          <ExplanationModal
            explanation={ev.appraisalExplanation}
            title={ev.title}
            onClose={() => setExplanationEventId(null)}
          />
        );
      })()}
    </>
  );
}
