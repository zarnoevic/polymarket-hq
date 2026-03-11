"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, Filter, Calendar, CalendarPlus, BarChart3, ExternalLink, Loader2, Search, RotateCw, Sparkles, X, Brain, Star, Compass, HelpCircle, BadgeCheck, TrendingUp, ClipboardList, ChevronDown, AlertTriangle, StickyNote, BookOpen, Percent } from "lucide-react";
import { toast } from "sonner";

type LabelType = "vetted" | "unknowable" | "well_priced" | "traded" | "evaluating" | "disputed" | "uninformed" | "under_5" | null;

const VALID_LABELS: ReadonlySet<string> = new Set([
  "vetted",
  "unknowable",
  "well_priced",
  "traded",
  "evaluating",
  "disputed",
  "uninformed",
  "under_5",
]);

function toLabelType(s: string | null | undefined): LabelType {
  if (s == null) return null;
  return VALID_LABELS.has(s) ? (s as LabelType) : null;
}

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
  createdAt: Date | null;
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
  label: LabelType;
  labelUpdatedAt?: Date | null;
  note: string | null;
  syncedAt: Date;
  raw?: unknown;
};

type ScreenerEventInput = Omit<ScreenerEvent, "label" | "note"> & {
  label?: string | null;
  note?: string | null;
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

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** Trim trailing punctuation that wraps URLs, e.g. ) or ). from (https://example.com). */
function trimUrlTrailingPunct(url: string): string {
  return url.replace(/[)\]\.,;!?]+$/, "");
}

function ExplanationText({ text }: { text: string }) {
  const segments: Array<{ type: "text" | "link"; content: string }> = [];
  let lastEnd = 0;
  for (const m of text.matchAll(URL_REGEX)) {
    const full = m[0];
    const url = trimUrlTrailingPunct(full);
    const trailing = full.slice(url.length);
    if (m.index! > lastEnd) {
      segments.push({ type: "text", content: text.slice(lastEnd, m.index) });
    }
    segments.push({ type: "link", content: url });
    if (trailing) {
      segments.push({ type: "text", content: trailing });
    }
    lastEnd = m.index! + full.length;
  }
  if (lastEnd < text.length) {
    segments.push({ type: "text", content: text.slice(lastEnd) });
  }
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300"
          >
            {seg.content}
          </a>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </div>
  );
}

export function ScreenerContent({
  initialEvents,
}: {
  initialEvents: ScreenerEventInput[];
}) {
  const [events, setEvents] = useState<ScreenerEvent[]>(
    initialEvents.map((e) => ({
      ...e,
      label:
        toLabelType(e.label) ??
        ((e as ScreenerEventInput & { watchlisted?: boolean }).watchlisted ? "vetted" : null),
      note: e.note ?? null,
    }))
  );
  const [refreshing, setRefreshing] = useState(false);
  const [appraisingIds, setAppraisingIds] = useState<Set<string>>(new Set());
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discovery" | "evaluating" | "vetted" | "traded" | "unknowable" | "well_priced" | "disputed" | "uninformed" | "under_5">("discovery");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [alsoClassifySiblingsIds, setAlsoClassifySiblingsIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const discoveryEvents = events
    .filter((e) => e.label === null)
    .sort((a, b) => {
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      return distA - distB;
    });
  const under5Events = events
    .filter((e) => e.label === "under_5")
    .sort((a, b) => {
      const syncedA = a.syncedAt ? new Date(a.syncedAt).getTime() : 0;
      const syncedB = b.syncedAt ? new Date(b.syncedAt).getTime() : 0;
      if (syncedA !== syncedB) return syncedB - syncedA;
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      return distA - distB;
    });
  const tabToLabel: Record<Exclude<typeof activeTab, "discovery" | "under_5">, LabelType> = {
    evaluating: "evaluating",
    vetted: "vetted",
    traded: "traded",
    unknowable: "unknowable",
    well_priced: "well_priced",
    disputed: "disputed",
    uninformed: "uninformed",
  };
  const displayedEvents =
    activeTab === "discovery"
      ? discoveryEvents
      : activeTab === "under_5"
        ? under5Events
        : activeTab === "evaluating"
        ? [...events.filter((e) => e.label === "evaluating")].sort((a, b) => {
            const at = a.labelUpdatedAt ? new Date(a.labelUpdatedAt).getTime() : 0;
            const bt = b.labelUpdatedAt ? new Date(b.labelUpdatedAt).getTime() : 0;
            return bt - at; // most recent first
          })
        : events.filter((e) => e.label === tabToLabel[activeTab]);

  function getSiblingIds(eventId: string): string[] {
    const ev = events.find((x) => x.id === eventId);
    if (!ev?.parentEventSlug) return [eventId];
    // Include parent (if in DB) + all children of that parent
    const parentSlug = ev.parentEventSlug;
    return events
      .filter(
        (e) =>
          e.parentEventSlug === parentSlug ||
          (e.slug === parentSlug && !e.parentEventSlug)
      )
      .map((e) => e.id);
  }

  async function handleSetLabel(eventId: string, label: LabelType) {
    const idsToUpdate = alsoClassifySiblingsIds.has(eventId)
      ? getSiblingIds(eventId)
      : [eventId];
    try {
      const results = await Promise.all(
        idsToUpdate.map((id) =>
          fetch("/api/screener/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: id, label }),
          }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
        )
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(failed[0].data?.error ?? "Failed to update label");
      }
      setEvents((prev) =>
        prev.map((e) =>
          idsToUpdate.includes(e.id)
            ? { ...e, label, labelUpdatedAt: label != null ? new Date() : e.labelUpdatedAt }
            : e
        )
      );
      const msg =
        label === null
          ? idsToUpdate.length > 1
            ? `Moved ${idsToUpdate.length} markets back to discovery`
            : "Moved back to discovery"
          : label === "vetted"
            ? idsToUpdate.length > 1
              ? `Added ${idsToUpdate.length} markets to vetted`
              : "Added to vetted"
            : label === "unknowable"
              ? idsToUpdate.length > 1
                ? `Marked ${idsToUpdate.length} markets as unknowable`
                : "Marked as unknowable"
              : label === "well_priced"
                ? idsToUpdate.length > 1
                  ? `Marked ${idsToUpdate.length} markets as well-priced`
                  : "Marked as well-priced"
                : label === "traded"
                  ? idsToUpdate.length > 1
                    ? `Marked ${idsToUpdate.length} markets as traded`
                    : "Marked as traded"
                  : label === "disputed"
                    ? idsToUpdate.length > 1
                      ? `Marked ${idsToUpdate.length} markets as disputed`
                      : "Marked as disputed"
                    : label === "uninformed"
                      ? idsToUpdate.length > 1
                        ? `Marked ${idsToUpdate.length} markets as uninformed`
                        : "Marked as uninformed"
                      : label === "under_5"
                        ? idsToUpdate.length > 1
                          ? `Moved ${idsToUpdate.length} markets to <5%`
                          : "Moved to <5%"
                        : idsToUpdate.length > 1
                          ? `Marked ${idsToUpdate.length} markets as evaluating`
                          : "Marked as evaluating";
      toast.success(msg);
      if (label === "evaluating") {
        setActiveTab("evaluating");
        handleAppraise(eventId, "think");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update label";
      toast.error(msg);
    }
  }

  async function handleSetNote(eventId: string, note: string | null) {
    setSavingNoteId(eventId);
    try {
      const res = await fetch("/api/screener/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update note");
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, note: note || null } : e))
      );
      setNoteEditingId(null);
      setNoteDraft("");
      toast.success(note ? "Note saved" : "Note cleared");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update note";
      toast.error(msg);
    } finally {
      setSavingNoteId(null);
    }
  }

  const canReappraise = (e: ScreenerEvent) =>
    e.lastAppraised != null && e.appraisedYes != null && e.appraisedNo != null;

  async function handleAppraise(eventId: string, mode: "deep" | "mini" | "reappraise" | "think") {
    const ev = events.find((x) => x.id === eventId);
    if (mode === "reappraise" && ev && !canReappraise(ev)) {
      toast.error("Reappraise requires a previous appraisal");
      return;
    }

    setAppraisingIds((prev) => new Set(prev).add(eventId));
    const labels = {
      deep: "Running deep research…",
      mini: "Running mini research…",
      reappraise: "Checking for new news…",
      think: "Extended thinking (GPT‑5)…",
    };
    toast.info(labels[mode]);
    try {
      const res = await fetch("/api/screener/appraise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [eventId], mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Appraise failed");
      const successLabels = {
        deep: "Deep appraisal complete",
        mini: "Mini appraisal complete",
        reappraise: "Reappraisal complete",
        think: "Think appraisal complete",
      };
      toast.success(successLabels[mode]);
      const listRes = await fetch("/api/screener/events");
      const list = await listRes.json();
      if (Array.isArray(list)) setEvents(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Appraise failed";
      toast.error(msg);
    } finally {
      setAppraisingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
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
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5">
              {[
                { tab: "discovery" as const, icon: Compass, label: "Discovery", count: discoveryEvents.length },
                { tab: "evaluating" as const, icon: ClipboardList, label: "Evaluating", count: events.filter((e) => e.label === "evaluating").length },
                { tab: "vetted" as const, icon: Star, label: "Vetted", count: events.filter((e) => e.label === "vetted").length },
                { tab: "traded" as const, icon: TrendingUp, label: "Traded", count: events.filter((e) => e.label === "traded").length },
              ].map(({ tab, icon: Icon, label, count }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-slate-700/60 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count > 0 && (
                    <span className="rounded bg-slate-600/50 px-1.5 py-0.5 text-xs">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative" ref={categoryRef}>
              <button
                onClick={() => setCategoryOpen(!categoryOpen)}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "unknowable" || activeTab === "well_priced" || activeTab === "disputed" || activeTab === "uninformed" || activeTab === "under_5"
                    ? "bg-slate-700/60 text-white"
                    : "text-slate-500 hover:text-slate-400"
                }`}
                title="More categories"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${categoryOpen ? "rotate-180" : ""}`} />
              </button>
              {categoryOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-700/60 bg-slate-800 py-1 shadow-xl">
                  {[
                    { tab: "under_5" as const, icon: Percent, label: "<5%", count: events.filter((e) => e.label === "under_5").length },
                    { tab: "unknowable" as const, icon: HelpCircle, label: "Unknowable", count: events.filter((e) => e.label === "unknowable").length },
                    { tab: "well_priced" as const, icon: BadgeCheck, label: "Well-priced", count: events.filter((e) => e.label === "well_priced").length },
                    { tab: "disputed" as const, icon: AlertTriangle, label: "Disputed", count: events.filter((e) => e.label === "disputed").length },
                    { tab: "uninformed" as const, icon: BookOpen, label: "Uninformed", count: events.filter((e) => e.label === "uninformed").length },
                  ].map(({ tab, icon: Icon, label, count }) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setCategoryOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                        activeTab === tab ? "bg-slate-700/60 text-white" : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {count > 0 && (
                        <span className="ml-auto rounded bg-slate-600/50 px-1.5 py-0.5 text-xs">
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
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
      ) : displayedEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-8 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
            {activeTab === "discovery" ? (
              <Compass className="h-8 w-8" />
            ) : activeTab === "evaluating" ? (
              <ClipboardList className="h-8 w-8" />
            ) : activeTab === "vetted" ? (
              <Star className="h-8 w-8" />
            ) : activeTab === "traded" ? (
              <TrendingUp className="h-8 w-8" />
            ) : activeTab === "under_5" ? (
              <Percent className="h-8 w-8" />
            ) : activeTab === "unknowable" ? (
              <HelpCircle className="h-8 w-8" />
            ) : activeTab === "disputed" ? (
              <AlertTriangle className="h-8 w-8" />
            ) : activeTab === "uninformed" ? (
              <BookOpen className="h-8 w-8" />
            ) : (
              <BadgeCheck className="h-8 w-8" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            {activeTab === "discovery"
              ? "No events in discovery"
              : activeTab === "under_5"
                ? "No <5% markets"
                : activeTab === "evaluating"
                  ? "No evaluating markets"
                  : activeTab === "vetted"
                    ? "No vetted markets yet"
                    : activeTab === "traded"
                      ? "No traded markets"
                      : activeTab === "unknowable"
                        ? "No unknowable markets"
                        : activeTab === "disputed"
                          ? "No disputed markets"
                          : activeTab === "uninformed"
                            ? "No uninformed markets"
                            : "No well-priced markets"}
          </h3>
          <p className="mt-2 text-slate-400">
            {activeTab === "discovery"
              ? "All events are labeled. Clear labels to add events to discovery."
              : activeTab === "under_5"
                ? "Markets with Yes or No probability <5%. Low priority (limited upside). Use Refresh to ingest new events."
                : activeTab === "evaluating"
                  ? "Use the Evaluating button in Discovery to move markets here."
                  : activeTab === "vetted"
                    ? "Click the star on any market in Discovery to add it to vetted."
                    : activeTab === "traded"
                      ? "Use the Traded button in Discovery to move markets here."
                      : activeTab === "unknowable"
                        ? "Use the Unknowable button in Discovery to move markets here."
                        : activeTab === "disputed"
                          ? "Use the Disputed button to move markets here."
                          : activeTab === "uninformed"
                            ? "Use the Uninformed button to move markets here."
                            : "Use the Well-priced button in Discovery to move markets here."}
          </p>
          <button
            onClick={() => setActiveTab("discovery")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700/60"
          >
            <Compass className="h-4 w-4" />
            View discovery
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BarChart3 className="h-4 w-4" />
            <span>
              {displayedEvents.length} markets
              {activeTab === "discovery" && " · sorted by probability closest to 50%"}
              {activeTab === "under_5" && " <5% (low priority)"}
              {activeTab === "evaluating" && " evaluating"}
              {activeTab === "vetted" && " vetted"}
              {activeTab === "traded" && " traded"}
              {activeTab === "unknowable" && " unknowable"}
              {activeTab === "well_priced" && " well-priced"}
              {activeTab === "disputed" && " disputed"}
              {activeTab === "uninformed" && " uninformed"}
            </span>
          </div>

          <div className="space-y-4">
            {displayedEvents.map((e) => {
              const rightContent = e.appraisalExplanation
                ? { title: "Appraisal explanation", text: e.appraisalExplanation }
                : e.description
                  ? { title: "Market description", text: e.description }
                  : null;
              const rawCreated = (e.raw as { createdAt?: string } | null)?.createdAt;
              const displayCreatedAt = e.createdAt ?? (rawCreated || null);
              return (
              <div key={e.id} className="flex w-full gap-4 items-stretch">
                <div className="w-1/2 min-w-0 shrink-0 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-lg backdrop-blur-sm transition-colors hover:border-slate-700/60">
                <div className="flex gap-4 p-5">
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => handleSetLabel(e.id, "evaluating")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "evaluating"
                          ? "text-violet-400"
                          : "text-slate-500 hover:text-violet-400/70"
                      }`}
                      title="Mark as evaluating"
                    >
                      <ClipboardList className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        handleSetLabel(e.id, e.label === "vetted" ? null : "vetted")
                      }
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "vetted"
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-slate-500 hover:text-amber-400/70"
                      }`}
                      title={e.label === "vetted" ? "Remove from vetted" : "Add to vetted"}
                    >
                      <Star
                        className={`h-5 w-5 ${e.label === "vetted" ? "fill-current" : ""}`}
                      />
                    </button>
                    <button
                      onClick={() => handleSetLabel(e.id, "traded")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "traded"
                          ? "text-indigo-400"
                          : "text-slate-500 hover:text-indigo-400/70"
                      }`}
                      title="Mark as traded"
                    >
                      <TrendingUp className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSetLabel(e.id, "unknowable")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "unknowable"
                          ? "text-slate-400"
                          : "text-slate-500 hover:text-slate-400"
                      }`}
                      title="Mark as unknowable"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSetLabel(e.id, "well_priced")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "well_priced"
                          ? "text-emerald-400"
                          : "text-slate-500 hover:text-emerald-400/70"
                      }`}
                      title="Mark as well-priced"
                    >
                      <BadgeCheck className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSetLabel(e.id, "disputed")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "disputed"
                          ? "text-amber-500"
                          : "text-slate-500 hover:text-amber-500/70"
                      }`}
                      title="Mark as disputed"
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleSetLabel(e.id, "uninformed")}
                      className={`rounded p-0.5 transition-colors ${
                        e.label === "uninformed"
                          ? "text-sky-400"
                          : "text-slate-500 hover:text-sky-400/70"
                      }`}
                      title="Mark as uninformed"
                    >
                      <BookOpen className="h-5 w-5" />
                    </button>
                    {e.label != null && (
                      <button
                        onClick={() => handleSetLabel(e.id, null)}
                        className="rounded p-0.5 text-slate-500 transition-colors hover:text-white"
                        title="Clear label (back to discovery)"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  {(e.image ?? e.icon) && (
                    <img
                      src={e.image ?? e.icon ?? ""}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white">{e.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <a
                        href={`https://polymarket.com/event/${e.parentEventSlug ?? e.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                      >
                        Polymarket
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {e.parentEventSlug && (
                        <label className="flex cursor-pointer items-center gap-1.5 text-slate-500 hover:text-slate-400">
                          <input
                            type="checkbox"
                            checked={alsoClassifySiblingsIds.has(e.id)}
                            onChange={() => {
                              setAlsoClassifySiblingsIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.id)) next.delete(e.id);
                                else next.add(e.id);
                                return next;
                              });
                            }}
                            className="rounded border-slate-600 bg-slate-800/60 text-indigo-500 focus:ring-indigo-500"
                          />
                          <span>Also classify sibling markets</span>
                        </label>
                      )}
                      {displayCreatedAt && !isNaN(new Date(displayCreatedAt).getTime()) && (
                        <span className="flex items-center gap-1 text-slate-500" title="Market creation (API)">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {formatDate(new Date(displayCreatedAt))}
                        </span>
                      )}
                      {e.endDate && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(e.endDate)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
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
                        <div className="min-w-[140px] flex flex-col gap-2">
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
                    {activeTab !== "discovery" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleAppraise(e.id, "deep")}
                        disabled={appraisingIds.has(e.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50"
                      >
                        {appraisingIds.has(e.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Search className="h-3 w-3" />
                        )}
                        Deep Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "think")}
                        disabled={appraisingIds.has(e.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
                      >
                        {appraisingIds.has(e.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Brain className="h-3 w-3" />
                        )}
                        Think Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "mini")}
                        disabled={appraisingIds.has(e.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50"
                      >
                        {appraisingIds.has(e.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Mini Appraise
                      </button>
                      <button
                        onClick={() => handleAppraise(e.id, "reappraise")}
                        disabled={appraisingIds.has(e.id) || e.lastAppraised == null}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {appraisingIds.has(e.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        Reappraise
                      </button>
                    </div>
                    )}
                    {activeTab !== "discovery" && (
                    <div className="mt-2">
                      {noteEditingId === e.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={noteDraft}
                            onChange={(ev) => setNoteDraft(ev.target.value)}
                            placeholder="Note (included in appraisal)"
                            className="w-full rounded border border-slate-600/60 bg-transparent px-0 py-1 text-sm text-slate-300 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSetNote(e.id, noteDraft.trim() || null)}
                              disabled={savingNoteId === e.id}
                              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                            >
                              {savingNoteId === e.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setNoteEditingId(null);
                                setNoteDraft("");
                              }}
                              className="text-xs text-slate-500 hover:text-slate-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setNoteEditingId(e.id);
                            setNoteDraft(e.note ?? "");
                          }}
                          className="flex items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-400"
                        >
                          <StickyNote className={`h-3.5 w-3.5 shrink-0 ${e.note ? "text-amber-500/70" : ""}`} />
                          {e.note ? (
                            <span className="text-slate-400">{e.note}</span>
                          ) : (
                            <span>Add note</span>
                          )}
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                </div>
                </div>
                <div className="w-1/2 min-w-0 shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/30 p-5">
                  <p className="mb-3 text-sm font-medium text-slate-400">{rightContent ? rightContent.title : "Market description"}</p>
                  <div className="max-h-80 overflow-y-auto pr-2 text-sm leading-relaxed">
                    {rightContent ? (
                      <ExplanationText text={rightContent.text} />
                    ) : (
                      <span className="text-slate-500">No description available</span>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

    </>
  );
}
