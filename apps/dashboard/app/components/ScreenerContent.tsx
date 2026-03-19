"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, Filter, Calendar, CalendarPlus, BarChart3, ExternalLink, Loader2, RotateCw, X, Brain, Star, Compass, HelpCircle, BadgeCheck, TrendingUp, ClipboardList, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, StickyNote, BookOpen, Percent, Copy, ScrollText, Clock, Search, Tag, Plus, Minus, DollarSign, ArrowLeftRight } from "lucide-react";

/** Icon: one circle with smaller circles sprouting (tree/siblings) */
function SiblingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Central circle (parent) */}
      <circle cx="12" cy="10" r="4" />
      {/* Sprouting circles (siblings) */}
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="12" cy="20" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      {/* Branches connecting center to sprouting nodes */}
      <path d="M9.2 12.8 L6.8 15.5" />
      <path d="M12 14 L12 17.5" />
      <path d="M14.8 12.8 L17.2 15.5" />
    </svg>
  );
}
import { toast } from "sonner";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { VolatilityDaysEstimate } from "./VolatilityDaysEstimate";
import { OrderBookLabel } from "./OrderBookLabel";
import { MarketFees } from "./MarketFees";
import { SpreadLabel } from "./SpreadLabel";
import { computeKellyCriterion } from "@/lib/kelly";

type LabelType = "vetted" | "unknowable" | "well_priced" | "traded" | "evaluating" | "disputed" | "uninformed" | "under_10" | "under_2k_vol" | null;

const VALID_LABELS: ReadonlySet<string> = new Set([
  "vetted",
  "unknowable",
  "well_priced",
  "traded",
  "evaluating",
  "disputed",
  "uninformed",
  "under_10",
  "under_2k_vol",
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
  lastThinkAppraisedAt?: Date | null;
  lastThinkAppraisalDurationSeconds?: number | null;
  lastReappraisedAt?: Date | null;
  lastReappraisalDurationSeconds?: number | null;
  yev: number | null;
  nev: number | null;
  appraisalExplanation: string | null;
  label: LabelType;
  labelUpdatedAt?: Date | null;
  note: string | null;
  syncedAt: Date;
  yesId: string | null;
  noId: string | null;
  yesSpread?: number | null;
  noSpread?: number | null;
  traderAppraisedYes?: number | null;
  kellyPosition?: string | null; // DB stores "yes" | "no"
  kellyC?: number | null;
  kellyCriterion?: number | null;
  raw?: unknown;
  tags?: unknown; // Gamma API tags: JsonValue from DB
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
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
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

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function formatTimeAgo(isoDate: string): string {
  const d = new Date(isoDate);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** ROI as "Xx" for large values; K/M/B/T for very large. */
function formatRoiAsX(roi: number): string {
  if (roi < 0 || !Number.isFinite(roi)) return "—";
  if (roi >= 1_000_000_000_000) {
    const t = roi / 1_000_000_000_000;
    return t >= 999.9 ? "999+Tx" : `${t.toFixed(1)}Tx`;
  }
  if (roi >= 1_000_000_000) return `${(roi / 1_000_000_000).toFixed(1)}Bx`;
  if (roi >= 1_000_000) return `${(roi / 1_000_000).toFixed(1)}Mx`;
  if (roi >= 1_000) return `${(roi / 1_000).toFixed(1)}Kx`;
  if (roi >= 100) return `${roi.toFixed(1)}x`;
  if (roi >= 10) return `${roi.toFixed(1)}x`;
  if (roi >= 1) return `${roi.toFixed(2)}x`;
  return `${roi.toFixed(2)}x`;
}

/** Format roi: r < 1 → %, r >= 1 → x (e.g. 0.99 → 99%, 4 → 4x). */
function formatRoi(roi: number): string {
  if (roi < 0 || !Number.isFinite(roi)) return "—";
  if (roi >= 1) return formatRoiAsX(roi);
  const pct = roi * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

/** Days until resolution; null if endDate missing or in the past. Uses UTC date diff. */
function daysToResolution(endDate: Date | string | null): number | null {
  if (!endDate) return null;
  const d = endDate instanceof Date ? endDate : new Date(endDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const resUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((resUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return days > 0 ? Math.max(1, days) : null;
}

/** Linear annualized return: r = (P1-P0)/P0, annual_return = r * (365/T). P0=buy price (price+spread), P1=1. */
function computePAROI(curPrice: number, days: number | null, spread?: number | null): string {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice > 1 || !Number.isFinite(buyPrice)) return "—";
  if (buyPrice <= 0 || buyPrice < 1e-9) return "999+x";
  const r = (1 - buyPrice) / buyPrice;
  const roi = days == null || days <= 0 ? r : r * (365 / days);
  return formatRoi(roi);
}

/** Simple (non-annualized) ROI: buy price = price + spread, r = (1 - buyPrice) / buyPrice. */
function computeROI(curPrice: number, spread?: number | null): string {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice > 1 || !Number.isFinite(buyPrice)) return "—";
  if (buyPrice <= 0 || buyPrice < 1e-9) return "999+x";
  const r = (1 - buyPrice) / buyPrice;
  return formatRoi(r);
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
  const [refreshElapsedSec, setRefreshElapsedSec] = useState(0);
  const [refreshStartTime, setRefreshStartTime] = useState<number | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [lastRefreshDurationSec, setLastRefreshDurationSec] = useState<number | null>(null);
  const [, setRefreshTick] = useState(0);
  const [appraisingIds, setAppraisingIds] = useState<Set<string>>(new Set());
  const [appraiseStartTimes, setAppraiseStartTimes] = useState<Map<string, number>>(new Map());
  const appraiseAbortRef = useRef<Map<string, AbortController>>(new Map());
  const [, setElapsedTick] = useState(0);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savingKellyId, setSavingKellyId] = useState<string | null>(null);
  const [kellyDrafts, setKellyDrafts] = useState<Record<string, { p: string; c: string; position: "yes" | "no" }>>({});
  const kellySaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [activeTab, setActiveTab] = useState<"discovery" | "evaluating" | "vetted" | "traded" | "unknowable" | "well_priced" | "disputed" | "uninformed" | "under_10" | "under_2k_vol" | "spread_gt_5c">("discovery");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const EVENTS_PER_PAGE = 10;
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [alsoClassifySiblingsIds, setAlsoClassifySiblingsIds] = useState<Set<string>>(new Set());

  // Siblings selected by default when events load
  useEffect(() => {
    setAlsoClassifySiblingsIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const e of events) {
        if (!next.has(e.id)) {
          next.add(e.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [events]);
  const [rulesPopupEventId, setRulesPopupEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [portfolioSummary, setPortfolioSummary] = useState<{
    portfolioValue: number;
    cash: number;
    cashPct: number;
  } | null>(null);
  const [allTags, setAllTags] = useState<Array<{ id: string; label: string; slug: string }>>([]);
  const [selectedTagPrefs, setSelectedTagPrefs] = useState<Array<{ tagId: string; label: string; slug: string }>>([]);
  const [excludedTagPrefs, setExcludedTagPrefs] = useState<Array<{ tagId: string; label: string; slug: string }>>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  const [syncingTags, setSyncingTags] = useState(false);
  const [savingTagPrefs, setSavingTagPrefs] = useState(false);
  const [insertSlugInput, setInsertSlugInput] = useState("");
  const [insertSlugLoading, setInsertSlugLoading] = useState(false);
  const [addBySlugOpen, setAddBySlugOpen] = useState(false);
  const tagsRef = useRef<HTMLDivElement>(null);
  const addBySlugRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
      if (addBySlugRef.current && !addBySlugRef.current.contains(e.target as Node)) {
        setAddBySlugOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load tag preferences and exclusions on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/screener/tag-preferences").then((r) => r.json()),
      fetch("/api/screener/tag-exclusions").then((r) => r.json()),
    ])
      .then(([prefs, exclusions]) => {
        if (Array.isArray(prefs)) setSelectedTagPrefs(prefs);
        if (Array.isArray(exclusions)) setExcludedTagPrefs(exclusions);
      })
      .catch(() => {});
  }, []);

  // Load last refresh status from SyncLog (stored in database)
  const fetchLastRefreshStatus = useCallback(() => {
    fetch("/api/screener/refresh-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.lastRefreshAt) setLastRefreshAt(data.lastRefreshAt);
        if (data.durationMs != null) setLastRefreshDurationSec(Math.round(data.durationMs / 1000));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetchLastRefreshStatus();
  }, [fetchLastRefreshStatus]);

  // Refresh elapsed timer when refreshing (updates every 500ms for smooth progress bar)
  useEffect(() => {
    if (!refreshing || !refreshStartTime) return;
    const id = setInterval(() => {
      setRefreshElapsedSec(Math.floor((Date.now() - refreshStartTime) / 1000));
      setRefreshTick((t) => t + 1);
    }, 500);
    return () => clearInterval(id);
  }, [refreshing, refreshStartTime]);

  // Load tags from DB once when dropdown opens (no refetch on search typing)
  useEffect(() => {
    if (!tagsOpen) return;
    setLoadingTags(true);
    fetch("/api/screener/tags")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllTags(data);
        else if (data && typeof data === "object" && "error" in data) toast.error(String(data.error));
      })
      .catch(() => toast.error("Failed to load tags"))
      .finally(() => setLoadingTags(false));
  }, [tagsOpen]);

  // Timer tick for appraise elapsed time
  useEffect(() => {
    if (appraisingIds.size === 0) return;
    const id = setInterval(() => setElapsedTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [appraisingIds.size]);

  // Fetch portfolio when viewing Kelly tabs (evaluating, vetted, traded)
  const kellyTabs = ["evaluating", "vetted", "traded"] as const;
  useEffect(() => {
    if (!(kellyTabs as readonly string[]).includes(activeTab)) return;
    fetch("/api/portfolio/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.portfolioValue != null && d.cash != null && d.cashPct != null) {
          setPortfolioSummary({
            portfolioValue: Number(d.portfolioValue),
            cash: Number(d.cash),
            cashPct: Number(d.cashPct),
          });
        }
      })
      .catch(() => {});
  }, [activeTab]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);
  useEffect(() => {
    setSearchPage(1);
  }, [searchQuery]);

  // Make siblings selected by default for all events when they load
  useEffect(() => {
    if (events.length === 0) return;
    setAlsoClassifySiblingsIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const e of events) {
        if (!next.has(e.id)) {
          next.add(e.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [events]);

  /** Exclude from discovery when any spread is >5¢ (poor liquidity). */
  const hasWideSpread = (e: ScreenerEvent) =>
    (e.yesSpread != null && e.yesSpread > 0.05) ||
    (e.noSpread != null && e.noSpread > 0.05);
  const discoveryEvents = events
    .filter((e) => e.label === null && !hasWideSpread(e))
    .sort((a, b) => {
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      return distA - distB;
    });
  const under10Events = events
    .filter((e) => e.label === "under_10")
    .sort((a, b) => {
      const syncedA = a.syncedAt ? new Date(a.syncedAt).getTime() : 0;
      const syncedB = b.syncedAt ? new Date(b.syncedAt).getTime() : 0;
      if (syncedA !== syncedB) return syncedB - syncedA;
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      return distA - distB;
    });
  const under2kVolEvents = events
    .filter((e) => e.label === "under_2k_vol")
    .sort((a, b) => {
      const syncedA = a.syncedAt ? new Date(a.syncedAt).getTime() : 0;
      const syncedB = b.syncedAt ? new Date(b.syncedAt).getTime() : 0;
      if (syncedA !== syncedB) return syncedB - syncedA;
      const distA = a.probabilityYes != null ? Math.abs(a.probabilityYes - 0.5) : Infinity;
      const distB = b.probabilityYes != null ? Math.abs(b.probabilityYes - 0.5) : Infinity;
      return distA - distB;
    });
  const spreadGt5cEvents = events
    .filter((e) => e.noSpread != null && e.noSpread > 0.05)
    .sort((a, b) => {
      const spreadA = a.noSpread ?? 0;
      const spreadB = b.noSpread ?? 0;
      if (spreadA !== spreadB) return spreadB - spreadA;
      const syncedA = a.syncedAt ? new Date(a.syncedAt).getTime() : 0;
      const syncedB = b.syncedAt ? new Date(b.syncedAt).getTime() : 0;
      return syncedB - syncedA;
    });
  const tabToLabel: Record<Exclude<typeof activeTab, "discovery" | "under_10" | "under_2k_vol" | "spread_gt_5c">, LabelType> = {
    evaluating: "evaluating",
    vetted: "vetted",
    traded: "traded",
    unknowable: "unknowable",
    well_priced: "well_priced",
    disputed: "disputed",
    uninformed: "uninformed",
  };
  const baseDisplayedEvents =
    activeTab === "discovery"
      ? discoveryEvents
      : activeTab === "under_10"
        ? under10Events
        : activeTab === "under_2k_vol"
          ? under2kVolEvents
          : activeTab === "spread_gt_5c"
            ? spreadGt5cEvents
            : activeTab === "evaluating"
        ? [...events.filter((e) => e.label === "evaluating")].sort((a, b) => {
            const at = a.labelUpdatedAt ? new Date(a.labelUpdatedAt).getTime() : 0;
            const bt = b.labelUpdatedAt ? new Date(b.labelUpdatedAt).getTime() : 0;
            return bt - at; // most recent first
          })
        : events.filter((e) => e.label === tabToLabel[activeTab]);

  /** Filter by search: id/externalId (exact), slug and name (partial, case-insensitive). */
  const q = searchQuery.trim();
  const qLower = q.toLowerCase();
  const matchesSearch = (e: ScreenerEvent) => {
    if (e.id === q || e.externalId === q) return true;
    if (e.slug?.toLowerCase().includes(qLower)) return true;
    if (e.title?.toLowerCase().includes(qLower)) return true;
    return false;
  };
  const displayedEvents = q
    ? baseDisplayedEvents.filter(matchesSearch)
    : baseDisplayedEvents;

  /** Search results from ALL categories (not just current tab) - shown in div above. */
  const searchResultsEvents = q ? events.filter(matchesSearch) : [];

  const totalTabPages = Math.max(1, Math.ceil(displayedEvents.length / EVENTS_PER_PAGE));
  const totalSearchPages = Math.max(1, Math.ceil(searchResultsEvents.length / EVENTS_PER_PAGE));
  const paginatedDisplayedEvents = displayedEvents.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  );
  const paginatedSearchResults = searchResultsEvents.slice(
    (searchPage - 1) * EVENTS_PER_PAGE,
    searchPage * EVENTS_PER_PAGE
  );

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
    const idsToUpdate =
      label !== "evaluating" &&
      label !== "vetted" &&
      alsoClassifySiblingsIds.has(eventId)
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
                      : label === "under_10"
                        ? idsToUpdate.length > 1
                          ? `Moved ${idsToUpdate.length} markets to <10%`
                          : "Moved to <10%"
                        : label === "under_2k_vol"
                          ? idsToUpdate.length > 1
                            ? `Moved ${idsToUpdate.length} markets to <2k VOL`
                            : "Moved to <2k VOL"
                          : idsToUpdate.length > 1
                          ? `Marked ${idsToUpdate.length} markets as evaluating`
                          : "Marked as evaluating";
      toast.success(msg);
      if (label === "evaluating") {
        const ev = events.find((x) => x.id === eventId);
        if (ev && ev.lastThinkAppraisedAt == null) {
          handleAppraise(eventId, "think");
        }
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

  async function handleSetKelly(
    eventId: string,
    traderAppraisedYes: number,
    kellyC: number,
    kellyPosition: "yes" | "no"
  ) {
    setSavingKellyId(eventId);
    try {
      const res = await fetch("/api/screener/kelly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, traderAppraisedYes, kellyC, kellyPosition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update Kelly");
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                traderAppraisedYes: data.traderAppraisedYes,
                kellyC: data.kellyC,
                kellyCriterion: data.kellyCriterion,
                kellyPosition: data.kellyPosition ?? "no",
              }
            : e
        )
      );
      toast.success("Kelly saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save Kelly";
      toast.error(msg);
    } finally {
      setSavingKellyId(null);
    }
  }

  async function handleToggleKellyPosition(eventId: string) {
    const ev = events.find((x) => x.id === eventId);
    if (!ev) return;
    const nextPos = (ev.kellyPosition ?? "no") === "yes" ? "no" : "yes";
    setSavingKellyId(eventId);
    try {
      const res = await fetch("/api/screener/kelly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, kellyPosition: nextPos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update position");
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                kellyPosition: data.kellyPosition ?? "no",
                kellyCriterion: data.kellyCriterion,
              }
            : e
        )
      );
      toast.success(`Position: ${nextPos.toUpperCase()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update position";
      toast.error(msg);
    } finally {
      setSavingKellyId(null);
    }
  }

  const canReappraise = (e: ScreenerEvent) =>
    e.lastAppraised != null && e.appraisedYes != null && e.appraisedNo != null;

  function handleCancelAppraise(eventId: string) {
    const ac = appraiseAbortRef.current.get(eventId);
    if (ac) {
      ac.abort();
      appraiseAbortRef.current.delete(eventId);
    }
    setAppraisingIds((prev) => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    setAppraiseStartTimes((prev) => {
      const next = new Map(prev);
      next.delete(eventId);
      return next;
    });
    toast.info("Appraisal cancelled");
  }

  async function handleAppraise(eventId: string, mode: "deep" | "mini" | "reappraise" | "think") {
    const ev = events.find((x) => x.id === eventId);
    if (mode === "reappraise" && ev && !canReappraise(ev)) {
      toast.error("Reappraise requires a previous appraisal");
      return;
    }

    const ac = new AbortController();
    appraiseAbortRef.current.set(eventId, ac);

    setAppraisingIds((prev) => new Set(prev).add(eventId));
    setAppraiseStartTimes((prev) => new Map(prev).set(eventId, Date.now()));
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
        signal: ac.signal,
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
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Appraise failed";
      toast.error(msg);
    } finally {
      appraiseAbortRef.current.delete(eventId);
      setAppraisingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      setAppraiseStartTimes((prev) => {
        const next = new Map(prev);
        next.delete(eventId);
        return next;
      });
    }
  }

  function formatElapsed(eventId: string): string {
    const start = appraiseStartTimes.get(eventId);
    if (start == null) return "";
    const s = Math.floor((Date.now() - start) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r > 0 ? `${m}m ${r}s` : `${m}m`;
  }

  async function handleRefresh() {
    setRefreshStartTime(Date.now());
    setRefreshElapsedSec(0);
    setRefreshing(true);
    toast.info("Fetching events from Gamma API…");
    try {
      const res = await fetch("/api/screener/refresh", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Refresh failed");
      }

      if (data.finishedAt) setLastRefreshAt(data.finishedAt);
      if (typeof data.durationMs === "number") setLastRefreshDurationSec(Math.round(data.durationMs / 1000));
      toast.success(`Synced ${data.count} events to database`);
      const listRes = await fetch("/api/screener/events?limit=10000");
      const list = await listRes.json();
      if (Array.isArray(list)) setEvents(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refresh failed";
      toast.error(msg);
    } finally {
      setRefreshing(false);
      setRefreshStartTime(null);
      setRefreshElapsedSec(0);
    }
  }

  function extractSlugFromInput(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      if (url.hostname?.includes("polymarket.com")) {
        const segs = url.pathname.split("/").filter(Boolean);
        const last = segs[segs.length - 1];
        return last ?? trimmed;
      }
    } catch {
      /* not a URL */
    }
    return trimmed;
  }

  async function handleInsertBySlug() {
    const slug = extractSlugFromInput(insertSlugInput);
    if (!slug) {
      toast.error("Enter a slug or Polymarket URL");
      return;
    }
    setInsertSlugLoading(true);
    try {
      const res = await fetch("/api/screener/insert-by-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Insert failed");
      toast.success(`Added ${data.count} market${data.count !== 1 ? "s" : ""} to discovery`);
      setInsertSlugInput("");
      setAddBySlugOpen(false);
      const listRes = await fetch("/api/screener/events?limit=10000");
      const list = await listRes.json();
      if (Array.isArray(list)) setEvents(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Insert failed");
    } finally {
      setInsertSlugLoading(false);
    }
  }

  async function handleToggleTagPreference(tag: { id: string; label: string; slug: string }) {
    const isSelected = selectedTagPrefs.some((p) => p.tagId === tag.id);
    const newPrefs = isSelected
      ? selectedTagPrefs.filter((p) => p.tagId !== tag.id)
      : [...selectedTagPrefs, { tagId: tag.id, label: tag.label, slug: tag.slug }];
    setSavingTagPrefs(true);
    try {
      const res = await fetch("/api/screener/tag-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newPrefs.map((p) => p.tagId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      if (Array.isArray(data)) setSelectedTagPrefs(data);
      else setSelectedTagPrefs(newPrefs);
      toast.success(isSelected ? "Tag removed" : "Tag added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tags");
    } finally {
      setSavingTagPrefs(false);
    }
  }

  async function handleAddToIncluded(tag: { id: string; label: string; slug: string }) {
    const newIncluded = [...selectedTagPrefs.filter((p) => p.tagId !== tag.id), { tagId: tag.id, label: tag.label, slug: tag.slug }];
    const newExcluded = excludedTagPrefs.filter((p) => p.tagId !== tag.id);
    setSavingTagPrefs(true);
    try {
      const [prefRes, exclRes] = await Promise.all([
        fetch("/api/screener/tag-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: newIncluded.map((p) => p.tagId) }),
        }),
        fetch("/api/screener/tag-exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: newExcluded.map((p) => p.tagId) }),
        }),
      ]);
      const [prefData, exclData] = await Promise.all([prefRes.json(), exclRes.json()]);
      if (!prefRes.ok) throw new Error(prefData?.error ?? "Failed to save");
      if (!exclRes.ok) throw new Error(exclData?.error ?? "Failed to save");
      setSelectedTagPrefs(Array.isArray(prefData) ? prefData : newIncluded);
      setExcludedTagPrefs(Array.isArray(exclData) ? exclData : newExcluded);
      toast.success("Tag added to included");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tags");
    } finally {
      setSavingTagPrefs(false);
    }
  }

  async function handleAddToExcluded(tag: { id: string; label: string; slug: string }) {
    const newIncluded = selectedTagPrefs.filter((p) => p.tagId !== tag.id);
    const newExcluded = [...excludedTagPrefs.filter((p) => p.tagId !== tag.id), { tagId: tag.id, label: tag.label, slug: tag.slug }];
    setSavingTagPrefs(true);
    try {
      const [prefRes, exclRes] = await Promise.all([
        fetch("/api/screener/tag-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: newIncluded.map((p) => p.tagId) }),
        }),
        fetch("/api/screener/tag-exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: newExcluded.map((p) => p.tagId) }),
        }),
      ]);
      const [prefData, exclData] = await Promise.all([prefRes.json(), exclRes.json()]);
      if (!prefRes.ok) throw new Error(prefData?.error ?? "Failed to save");
      if (!exclRes.ok) throw new Error(exclData?.error ?? "Failed to save");
      setSelectedTagPrefs(Array.isArray(prefData) ? prefData : newIncluded);
      setExcludedTagPrefs(Array.isArray(exclData) ? exclData : newExcluded);
      toast.success("Tag added to excluded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tags");
    } finally {
      setSavingTagPrefs(false);
    }
  }

  async function handleRemoveFromExcluded(tag: { id: string; label: string; slug: string }) {
    const newExcluded = excludedTagPrefs.filter((p) => p.tagId !== tag.id);
    setSavingTagPrefs(true);
    try {
      const res = await fetch("/api/screener/tag-exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newExcluded.map((p) => p.tagId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setExcludedTagPrefs(Array.isArray(data) ? data : newExcluded);
      toast.success("Tag removed from excluded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tags");
    } finally {
      setSavingTagPrefs(false);
    }
  }

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 min-w-0 max-w-md items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search markets by id, slug, or name…"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-800/40 py-2.5 pl-10 pr-10 text-sm text-beige placeholder-slate-500 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                aria-label="Search markets by id, slug, or name"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-beige"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-beige transition-colors hover:bg-slate-700/60"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
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
                      ? "bg-slate-700/60 text-beige"
                      : "text-slate-400 hover:text-beige"
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
                  activeTab === "unknowable" || activeTab === "well_priced" || activeTab === "disputed" || activeTab === "uninformed" || activeTab === "under_10" || activeTab === "under_2k_vol" || activeTab === "spread_gt_5c"
                    ? "bg-slate-700/60 text-beige"
                    : "text-slate-500 hover:text-slate-400"
                }`}
                title="More categories"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${categoryOpen ? "rotate-180" : ""}`} />
              </button>
              {categoryOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 max-h-[min(400px,80vh)] w-64 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-800 py-2 shadow-xl">
                  <div className="grid grid-cols-1 gap-0.5 px-2">
                    {[
                      { tab: "under_10" as const, icon: Percent, label: "<10%", count: events.filter((e) => e.label === "under_10").length },
                      { tab: "under_2k_vol" as const, icon: DollarSign, label: "<2k VOL", count: events.filter((e) => e.label === "under_2k_vol").length },
                      { tab: "spread_gt_5c" as const, icon: ArrowLeftRight, label: ">5¢ spread", count: events.filter((e) => e.noSpread != null && e.noSpread > 0.05).length },
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
                        className={`flex items-center gap-2 px-3 py-2 text-left text-sm ${
                          activeTab === tab ? "bg-slate-700/60 text-beige rounded" : "text-slate-300 hover:bg-slate-700/60 hover:text-beige rounded"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                        {count > 0 && (
                          <span className="ml-auto shrink-0 rounded bg-slate-600/50 px-1.5 py-0.5 text-xs">
                            {count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={tagsRef}>
              <button
                onClick={() => setTagsOpen(!tagsOpen)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  selectedTagPrefs.length > 0 || excludedTagPrefs.length > 0
                    ? "bg-slate-700/60 text-beige"
                    : "text-slate-500 hover:text-slate-400"
                }`}
                title="Select tags for refresh (Refresh fetches markets for selected tags only)"
              >
                <Tag className="h-4 w-4" />
                <span className="hidden sm:inline">Tags</span>
                {(selectedTagPrefs.length > 0 || excludedTagPrefs.length > 0) && (
                  <span className="flex items-center gap-1">
                    {selectedTagPrefs.length > 0 && (
                      <span className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-xs text-indigo-300">
                        {selectedTagPrefs.length}
                      </span>
                    )}
                    {excludedTagPrefs.length > 0 && (
                      <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-xs text-rose-300">
                        {excludedTagPrefs.length}
                      </span>
                    )}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${tagsOpen ? "rotate-180" : ""}`} />
              </button>
              {tagsOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-[420px] max-h-[480px] rounded-lg border border-slate-700/60 bg-slate-800 shadow-xl flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-slate-700/60 space-y-2">
                    <input
                      type="search"
                      value={tagSearchInput}
                      onChange={(e) => setTagSearchInput(e.target.value)}
                      placeholder="Search tags (from DB)…"
                      className="w-full rounded border border-slate-600/60 bg-slate-900/50 px-3 py-2 text-sm text-beige placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setSyncingTags(true);
                        try {
                          const r = await fetch("/api/screener/tags/sync", { method: "POST" });
                          const data = await r.json();
                          if (!r.ok) throw new Error(data.error ?? "Sync failed");
                          toast.success(`Synced ${data.count ?? 0} tags from Gamma`);
                          const res = await fetch("/api/screener/tags");
                          const tags = await res.json();
                          if (Array.isArray(tags)) setAllTags(tags);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Sync failed");
                        } finally {
                          setSyncingTags(false);
                        }
                      }}
                      disabled={syncingTags}
                      className="flex w-full items-center justify-center gap-2 rounded border border-slate-600/60 bg-slate-800/60 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 disabled:opacity-50"
                    >
                      {syncingTags ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Sync from Gamma
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[360px] p-1">
                    {loadingTags ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="space-y-0.5">
                          <p className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider">Included</p>
                          <div className="flex flex-wrap gap-1 px-2">
                            {selectedTagPrefs.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">None</span>
                            ) : (
                              selectedTagPrefs.map((p) => (
                                <span
                                  key={p.tagId}
                                  className="inline-flex items-center gap-0.5 rounded bg-indigo-500/20 px-1.5 py-px text-[10px] text-indigo-300"
                                >
                                  <span className="truncate max-w-[120px]">{p.label}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToExcluded({ id: p.tagId, label: p.label, slug: p.slug })}
                                    disabled={savingTagPrefs}
                                    className="shrink-0 rounded p-0.5 text-indigo-400/80 hover:bg-indigo-500/30 hover:text-indigo-300 disabled:opacity-50"
                                    title="Exclude"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTagPreference({ id: p.tagId, label: p.label, slug: p.slug })}
                                    disabled={savingTagPrefs}
                                    className="shrink-0 rounded p-0.5 text-indigo-400/80 hover:bg-indigo-500/30 hover:text-indigo-300 disabled:opacity-50"
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider">Excluded</p>
                          <div className="flex flex-wrap gap-1 px-2">
                            {excludedTagPrefs.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">None</span>
                            ) : (
                              excludedTagPrefs.map((p) => (
                                <span
                                  key={p.tagId}
                                  className="inline-flex items-center gap-0.5 rounded bg-rose-500/20 px-1.5 py-px text-[10px] text-rose-300"
                                >
                                  <span className="truncate max-w-[120px]">{p.label}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToIncluded({ id: p.tagId, label: p.label, slug: p.slug })}
                                    disabled={savingTagPrefs}
                                    className="shrink-0 rounded p-0.5 text-rose-400/80 hover:bg-rose-500/30 hover:text-rose-300 disabled:opacity-50"
                                    title="Include"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromExcluded({ id: p.tagId, label: p.label, slug: p.slug })}
                                    disabled={savingTagPrefs}
                                    className="shrink-0 rounded p-0.5 text-rose-400/80 hover:bg-rose-500/30 hover:text-rose-300 disabled:opacity-50"
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {tagSearchInput.trim() ? "Search results" : "All tags"}
                          </p>
                          {(function () {
                            const q = tagSearchInput.trim();
                            const selectedIds = new Set(selectedTagPrefs.map((p) => p.tagId));
                            const excludedIds = new Set(excludedTagPrefs.map((p) => p.tagId));
                            const isIncludedOrExcluded = (t: { id: string }) => selectedIds.has(t.id) || excludedIds.has(t.id);
                            const filtered = !q
                              ? allTags.filter((t) => !isIncludedOrExcluded(t))
                              : (() => {
                                  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
                                  return allTags.filter((t) => {
                                    if (isIncludedOrExcluded(t)) return false;
                                    const searchable = `${(t.label ?? "").toLowerCase()} ${(t.slug ?? "").toLowerCase()} ${t.id}`;
                                    return tokens.every((token) => searchable.includes(token));
                                  });
                                })();
                            if (filtered.length === 0) {
                              return (
                                <p className="py-4 text-center text-sm text-slate-500">
                                  {q ? "No tags found" : "No other tags"}
                                </p>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1 px-2 pb-2">
                                {filtered.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center gap-0.5 rounded bg-slate-700/60 px-2 py-1 text-xs text-slate-300"
                                  >
                                    <span className="truncate max-w-[140px]">{tag.label}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddToIncluded(tag)}
                                      disabled={savingTagPrefs}
                                      className="shrink-0 rounded p-0.5 text-emerald-400/80 hover:bg-emerald-500/30 hover:text-emerald-300 disabled:opacity-50"
                                      title="Include"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddToExcluded(tag)}
                                      disabled={savingTagPrefs}
                                      className="shrink-0 rounded p-0.5 text-rose-400/80 hover:bg-rose-500/30 hover:text-rose-300 disabled:opacity-50"
                                      title="Exclude"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  {(selectedTagPrefs.length > 0 || excludedTagPrefs.length > 0) && (
                    <div className="border-t border-slate-700/60 p-2 text-xs text-slate-400">
                      {selectedTagPrefs.length} included · {excludedTagPrefs.length} excluded · Refresh fetches included only, skips markets with excluded tags
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative inline-flex flex-col items-end shrink-0">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-beige transition-colors hover:bg-slate-700/60 disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
              {(refreshing || lastRefreshAt) && (
                <div className="absolute right-0 top-full mt-1 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-[140px] justify-end">
                    {refreshing ? (
                      <>
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Elapsed: {formatDurationSeconds(refreshElapsedSec)}</span>
                      </>
                    ) : lastRefreshAt ? (
                      <>
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Last: {formatTimeAgo(lastRefreshAt)}</span>
                      </>
                    ) : null}
                  </div>
                  {refreshing && (
                    <div
                      className="h-1.5 w-24 rounded-full bg-slate-700/80 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={
                        lastRefreshDurationSec != null && lastRefreshDurationSec > 0
                          ? Math.min(95, Math.round((refreshElapsedSec / lastRefreshDurationSec) * 100))
                          : undefined
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${
                          lastRefreshDurationSec != null && lastRefreshDurationSec > 0
                            ? "bg-indigo-500 transition-all duration-300"
                            : "bg-indigo-500 animate-[shimmer_1.5s_ease-in-out_infinite]"
                        }`}
                        style={
                          lastRefreshDurationSec != null && lastRefreshDurationSec > 0
                            ? { width: `${Math.min(95, (refreshElapsedSec / lastRefreshDurationSec) * 100)}%` }
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative" ref={addBySlugRef}>
              <button
                onClick={() => setAddBySlugOpen(!addBySlugOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-beige transition-colors hover:bg-slate-700/60"
                title="Add event(s) by Polymarket slug"
              >
                <Plus className="h-4 w-4" />
                Add by slug
                <ChevronDown className={`h-4 w-4 transition-transform ${addBySlugOpen ? "rotate-180" : ""}`} />
              </button>
              {addBySlugOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 flex w-80 flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-800 p-3 shadow-xl">
                  <input
                    type="text"
                    value={insertSlugInput}
                    onChange={(e) => setInsertSlugInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInsertBySlug()}
                    placeholder="Enter Polymarket slug or event URL…"
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-sm text-beige placeholder-slate-500 focus:border-slate-600 focus:outline-none"
                    disabled={insertSlugLoading}
                    autoFocus
                  />
                  <button
                    onClick={handleInsertBySlug}
                    disabled={insertSlugLoading || !insertSlugInput.trim()}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-sm font-medium text-beige transition-colors hover:bg-slate-700/60 disabled:opacity-50"
                    title="Insert event(s) into discovery by Polymarket slug"
                  >
                    {insertSlugLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-8 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
            <Filter className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-beige">
            No events yet
          </h3>
          <p className="mt-2 text-slate-400">
            Click <strong>Refresh</strong> to fetch events from the Gamma API and store them in the database.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-beige transition-colors hover:bg-indigo-600 disabled:opacity-50"
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
        <div>
          {q && searchResultsEvents.length > 0 && (
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <span>Search results: {searchResultsEvents.length} markets (all categories)</span>
              </div>
              <div className="space-y-2">
                {paginatedSearchResults.map((e) => {
                  const rightContent = e.appraisalExplanation
                    ? { title: "Appraisal explanation", text: e.appraisalExplanation }
                    : e.description
                      ? { title: "Market description", text: e.description }
                      : null;
                  const rawCreated = (e.raw as { createdAt?: string } | null)?.createdAt;
                  const displayCreatedAt = e.createdAt ?? (rawCreated || null);
                  const showAppraise = e.label != null;
                  return (
                    <div key={`search-${e.id}`} className="flex w-full gap-3 items-stretch">
                      <div className="w-1/2 min-w-0 shrink-0 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-lg backdrop-blur-sm transition-colors hover:border-slate-700/60">
                        <div className="flex gap-3 p-3">
                          <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <button
                              onClick={() => handleSetLabel(e.id, "evaluating")}
                              className={`rounded p-0.5 transition-colors ${e.label === "evaluating" ? "text-violet-400" : "text-slate-500 hover:text-violet-400/70"}`}
                              title="Mark as evaluating"
                            >
                              <ClipboardList className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, e.label === "vetted" ? null : "vetted")}
                              className={`rounded p-0.5 transition-colors ${e.label === "vetted" ? "text-amber-400 hover:text-amber-300" : "text-slate-500 hover:text-amber-400/70"}`}
                              title={e.label === "vetted" ? "Remove from vetted" : "Add to vetted"}
                            >
                              <Star className={`h-5 w-5 ${e.label === "vetted" ? "fill-current" : ""}`} />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, "traded")}
                              className={`rounded p-0.5 transition-colors ${e.label === "traded" ? "text-indigo-400" : "text-slate-500 hover:text-indigo-400/70"}`}
                              title="Mark as traded"
                            >
                              <TrendingUp className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, "unknowable")}
                              className={`rounded p-0.5 transition-colors ${e.label === "unknowable" ? "text-slate-400" : "text-slate-500 hover:text-slate-400"}`}
                              title="Mark as unknowable"
                            >
                              <HelpCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, "well_priced")}
                              className={`rounded p-0.5 transition-colors ${e.label === "well_priced" ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400/70"}`}
                              title="Mark as well-priced"
                            >
                              <BadgeCheck className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, "disputed")}
                              className={`rounded p-0.5 transition-colors ${e.label === "disputed" ? "text-amber-500" : "text-slate-500 hover:text-amber-500/70"}`}
                              title="Mark as disputed"
                            >
                              <AlertTriangle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleSetLabel(e.id, "uninformed")}
                              className={`rounded p-0.5 transition-colors ${e.label === "uninformed" ? "text-sky-400" : "text-slate-500 hover:text-sky-400/70"}`}
                              title="Mark as uninformed"
                            >
                              <BookOpen className="h-5 w-5" />
                            </button>
                            {e.label != null && (
                              <button
                                onClick={() => handleSetLabel(e.id, null)}
                                className="rounded p-0.5 text-slate-500 transition-colors hover:text-beige"
                                title="Clear label (back to discovery)"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            )}
                            {e.parentEventSlug && (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={alsoClassifySiblingsIds.has(e.id)}
                                aria-label="Also classify sibling markets"
                                title="Also classify sibling markets"
                                onClick={() => {
                                  setAlsoClassifySiblingsIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(e.id)) next.delete(e.id);
                                    else next.add(e.id);
                                    return next;
                                  });
                                }}
                                className={`mt-2 flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200 ${alsoClassifySiblingsIds.has(e.id) ? "bg-indigo-500/20 text-indigo-400 shadow-sm ring-1 ring-indigo-500/30 hover:bg-indigo-500/30" : "bg-slate-800/40 text-slate-500 ring-1 ring-slate-700/50 hover:bg-slate-700/50 hover:text-slate-400 hover:ring-slate-600/60"}`}
                              >
                                <SiblingsIcon className="h-4 w-4" />
                                <span className="text-[10px] font-medium leading-tight">Siblings</span>
                              </button>
                            )}
                          </div>
                          {(e.image ?? e.icon) && (
                            <img src={e.image ?? e.icon ?? ""} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="min-w-0 flex-1 font-medium text-beige">{e.title}</h3>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  ev.preventDefault();
                                  navigator.clipboard.writeText(e.title ?? "");
                                  toast.success("Market name copied");
                                }}
                                className="inline-flex shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300"
                                title="Copy market name"
                                aria-label="Copy market name"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              {e.label != null && (
                                <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400">
                                  {e.label.replace("_", "-")}
                                </span>
                              )}
                            </div>
                            {e.tags && Array.isArray(e.tags) && e.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(e.tags as Array<{ id?: string; label?: string; slug?: string }>).map((t, i) => (
                                  <span key={t.id ?? t.slug ?? `tag-${i}`} className="inline-flex rounded bg-slate-700/60 px-1.5 py-px text-[10px] text-slate-300">
                                    {t.label ?? t.slug ?? t.id ?? "—"}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 flex w-full items-center gap-2 text-xs">
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <a
                                  href={`https://polymarket.com/event/${e.parentEventSlug ?? e.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                                >
                                  Polymarket
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => { navigator.clipboard.writeText(e.externalId); toast.success("Market ID copied"); }}
                                  className="inline-flex items-center gap-1 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300"
                                  title="Copy market ID"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                {displayCreatedAt && !isNaN(new Date(displayCreatedAt).getTime()) && (
                                  <span className="flex items-center gap-1 text-slate-500">
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
                              <div className="min-w-0 flex-1 pl-2 self-center h-4">
                                <PriceHistorySparkline tokenId={e.yesId ?? null} tint="yes" fill />
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              {(() => {
                                const days = daysToResolution(e.endDate);
                                return days != null ? (
                                  <div className="leading-tight">
                                    <p className="text-[11px] text-slate-500">Days left</p>
                                    <p className="font-mono text-sm font-medium text-slate-300">{days} {days === 1 ? "day" : "days"}</p>
                                  </div>
                                ) : null;
                              })()}
                              <div className="leading-tight">
                                <p className="text-[11px] text-slate-500">Volume</p>
                                <p className="font-mono text-sm font-medium text-beige">{formatCompact(e.volume)}</p>
                              </div>
                              <div className="leading-tight">
                                <p className="text-[11px] text-slate-500">Liquidity</p>
                                <p className="font-mono text-sm font-medium text-slate-300">{formatCompact(e.liquidity)}</p>
                              </div>
                            </div>
                            {showAppraise && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() => handleAppraise(e.id, "think")}
                                  disabled={appraisingIds.has(e.id)}
                                  className="flex items-center gap-1.5 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
                                >
                                  {appraisingIds.has(e.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                                  Think Appraise
                                </button>
                                <button
                                  onClick={() => handleAppraise(e.id, "reappraise")}
                                  disabled={appraisingIds.has(e.id) || e.lastAppraised == null}
                                  className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-beige transition-colors hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {appraisingIds.has(e.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                                  Reappraise
                                </button>
                                {appraisingIds.has(e.id) && (
                                  <button
                                    onClick={() => handleCancelAppraise(e.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-500/60 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancel
                                  </button>
                                )}
                                {e.description && (
                                  <button
                                    onClick={() => setRulesPopupEventId(e.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/60"
                                  >
                                    <ScrollText className="h-3 w-3" />
                                    Show rules
                                  </button>
                                )}
                              </div>
                            )}
                            {showAppraise && (
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
                                      <button onClick={() => handleSetNote(e.id, noteDraft.trim() || null)} disabled={savingNoteId === e.id} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50">Save</button>
                                      <button onClick={() => { setNoteEditingId(null); setNoteDraft(""); }} className="text-xs text-slate-500 hover:text-slate-400">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setNoteEditingId(e.id); setNoteDraft(e.note ?? ""); }}
                                    className="flex items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-400"
                                  >
                                    <StickyNote className={`h-3.5 w-3.5 shrink-0 ${e.note ? "text-amber-500/70" : ""}`} />
                                    {e.note ? <span className="text-slate-400">{e.note}</span> : <span>Add note</span>}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-1/2 min-w-0 shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
                        <p className="mb-2 text-sm font-medium text-slate-400">{rightContent ? rightContent.title : "Market description"}</p>
                        <div className="max-h-56 overflow-y-auto pr-2 text-sm leading-relaxed">
                          {rightContent ? <ExplanationText text={rightContent.text} /> : <span className="text-slate-500">No description available</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalSearchPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <button
                    onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                    disabled={searchPage <= 1}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-slate-400 tabular-nums">
                    Page {searchPage} of {totalSearchPages}
                  </span>
                  <button
                    onClick={() => setSearchPage((p) => Math.min(totalSearchPages, p + 1))}
                    disabled={searchPage >= totalSearchPages}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {displayedEvents.length === 0 ? (
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
            ) : activeTab === "under_10" ? (
              <Percent className="h-8 w-8" />
            ) : activeTab === "under_2k_vol" ? (
              <DollarSign className="h-8 w-8" />
            ) : activeTab === "spread_gt_5c" ? (
              <ArrowLeftRight className="h-8 w-8" />
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
          <h3 className="mt-4 text-lg font-semibold text-beige">
            {activeTab === "discovery"
              ? "No events in discovery"
              : activeTab === "under_10"
                ? "No <10% markets"
                : activeTab === "under_2k_vol"
                  ? "No <2k VOL markets"
                  : activeTab === "spread_gt_5c"
                    ? "No >5¢ spread (NO) markets"
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
              : activeTab === "under_10"
                ? "Markets with Yes or No probability ≤10%. Low priority (limited upside). Use Refresh to ingest new events."
                : activeTab === "under_2k_vol"
                  ? "Markets with volume <$2k. Low liquidity. Use Refresh to ingest new events."
                  : activeTab === "spread_gt_5c"
                    ? "Markets with NO order book spread >5¢. Wide spreads reduce effective ROI."
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
            onClick={activeTab === "discovery" ? handleRefresh : () => setActiveTab("discovery")}
            disabled={activeTab === "discovery" && refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-beige transition-colors hover:bg-slate-700/60 disabled:opacity-50"
          >
            {activeTab === "discovery" ? (
              refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )
            ) : (
              <Compass className="h-4 w-4" />
            )}
            {activeTab === "discovery" ? "Refresh" : "View discovery"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <BarChart3 className="h-4 w-4" />
              <span>
                {displayedEvents.length} markets
                {activeTab === "discovery" && " · sorted by probability closest to 50%"}
                {activeTab === "under_10" && " <10% (low priority)"}
                {activeTab === "under_2k_vol" && " <2k VOL (low volume)"}
                {activeTab === "spread_gt_5c" && " >5¢ spread (NO order book)"}
                {activeTab === "evaluating" && " evaluating"}
                {activeTab === "vetted" && " vetted"}
                {activeTab === "traded" && " traded"}
                {activeTab === "unknowable" && " unknowable"}
                {activeTab === "well_priced" && " well-priced"}
                {activeTab === "disputed" && " disputed"}
                {activeTab === "uninformed" && " uninformed"}
              </span>
            </div>
            {(kellyTabs as readonly string[]).includes(activeTab) && portfolioSummary != null && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-600/80 bg-slate-800/60 px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Portfolio</span>
                <span className="text-base font-semibold text-emerald-400" title="% of portfolio in cash (Polygon USDC)">
                  {portfolioSummary.cashPct.toFixed(1)}% cash
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-base font-semibold text-violet-400" title="% of portfolio in positions">
                  {(100 - portfolioSummary.cashPct).toFixed(1)}% positions
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {paginatedDisplayedEvents.map((e) => {
              const rightContent = e.appraisalExplanation
                ? { title: "Appraisal explanation", text: e.appraisalExplanation }
                : e.description
                  ? { title: "Market description", text: e.description }
                  : null;
              const rawCreated = (e.raw as { createdAt?: string } | null)?.createdAt;
              const displayCreatedAt = e.createdAt ?? (rawCreated || null);
              const isKellyTab = (kellyTabs as readonly string[]).includes(activeTab);
              const hasProbs = e.probabilityYes != null || e.probabilityNo != null;
              const kellyCOptions = [1, 2, 4] as const;
              const kellyDef = isKellyTab && hasProbs
                ? (kellyDrafts[e.id] ?? {
                    p: ((e.traderAppraisedYes ?? e.appraisedYes) != null ? ((e.traderAppraisedYes ?? e.appraisedYes)! * 100).toString() : ""),
                    c: e.kellyC != null && kellyCOptions.includes(e.kellyC as 1 | 2 | 4) ? e.kellyC.toString() : "4",
                    position: (e.kellyPosition ?? "no") as "yes" | "no",
                  })
                : null;
              return (
              <div key={e.id} className="flex w-full gap-3 items-stretch">
                <div className="w-1/2 min-w-0 shrink-0 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-lg backdrop-blur-sm transition-colors hover:border-slate-700/60">
                <div className="flex gap-3 p-3">
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
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
                        className="rounded p-0.5 text-slate-500 transition-colors hover:text-beige"
                        title="Clear label (back to discovery)"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                    {e.parentEventSlug && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alsoClassifySiblingsIds.has(e.id)}
                        aria-label="Also classify sibling markets"
                        title="Also classify sibling markets"
                        onClick={() => {
                          setAlsoClassifySiblingsIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(e.id)) next.delete(e.id);
                            else next.add(e.id);
                            return next;
                          });
                        }}
                        className={`mt-2 flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200 ${
                          alsoClassifySiblingsIds.has(e.id)
                            ? "bg-indigo-500/20 text-indigo-400 shadow-sm ring-1 ring-indigo-500/30 hover:bg-indigo-500/30"
                            : "bg-slate-800/40 text-slate-500 ring-1 ring-slate-700/50 hover:bg-slate-700/50 hover:text-slate-400 hover:ring-slate-600/60"
                        }`}
                      >
                        <SiblingsIcon className="h-4 w-4" />
                        <span className="text-[10px] font-medium leading-tight">Siblings</span>
                      </button>
                    )}
                  </div>
                  {(e.image ?? e.icon) && (
                    <img
                      src={e.image ?? e.icon ?? ""}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 font-medium text-beige">{e.title}</h3>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          ev.preventDefault();
                          navigator.clipboard.writeText(e.title ?? "");
                          toast.success("Market name copied");
                        }}
                        className="inline-flex shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300"
                        title="Copy market name"
                        aria-label="Copy market name"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {e.tags && Array.isArray(e.tags) && e.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {(e.tags as Array<{ id?: string; label?: string; slug?: string }>).map((t, i) => {
                          const tagId = t.id ?? t.slug ?? null;
                          return (
                            <span
                              key={t.id ?? t.slug ?? `tag-${i}`}
                              className={`group/tag relative inline-flex rounded bg-slate-700/60 px-1.5 py-px text-[10px] text-slate-300 ${tagId ? "cursor-pointer" : ""}`}
                            >
                              <span
                                className="block"
                                onClick={
                                  tagId
                                    ? (ev) => {
                                        ev.stopPropagation();
                                        ev.preventDefault();
                                        navigator.clipboard.writeText(tagId);
                                        toast.success("Tag ID copied");
                                      }
                                    : undefined
                                }
                                title={tagId ? "Click to copy tag ID" : undefined}
                              >
                                {t.label ?? t.slug ?? t.id ?? "—"}
                              </span>
                              {tagId && (
                                <span className="absolute top-full left-1/2 z-10 mt-1 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-300 shadow-lg ring-1 ring-slate-700 opacity-0 transition-opacity group-hover/tag:opacity-100 pointer-events-none">
                                  <span className="font-mono">{tagId}</span>
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-1 flex w-full items-center gap-2 text-xs">
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <a
                          href={`https://polymarket.com/event/${e.parentEventSlug ?? e.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          Polymarket
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(e.externalId);
                            toast.success("Market ID copied");
                          }}
                          className="inline-flex items-center gap-1 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300"
                          title="Copy market ID"
                          aria-label="Copy market ID"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
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
                      <div className="min-w-0 flex-1 pl-2 self-center h-4">
                        <PriceHistorySparkline tokenId={e.yesId ?? null} tint="yes" fill />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {(() => {
                          const days = daysToResolution(e.endDate);
                          return days != null ? (
                            <div className="leading-tight">
                              <p className="text-[11px] text-slate-500">Days left</p>
                              <p className="font-mono text-sm font-medium text-slate-300">
                                {days} {days === 1 ? "day" : "days"}
                              </p>
                            </div>
                          ) : null;
                        })()}
                        <div className="leading-tight">
                          <p className="text-[11px] text-slate-500">Volume</p>
                          <p className="font-mono text-sm font-medium text-beige">
                            {formatCompact(e.volume)}
                          </p>
                        </div>
                        <div className="leading-tight">
                          <p className="text-[11px] text-slate-500">Liquidity</p>
                          <p className="font-mono text-sm font-medium text-slate-300">
                            {formatCompact(e.liquidity)}
                          </p>
                        </div>
                        {e.yesId && (
                          <div className="leading-tight">
                            <p className="text-[11px] text-slate-500">Spread</p>
                            <SpreadLabel tokenId={e.noId} />
                          </div>
                        )}
                        {(e.yesId || e.noId) && (
                          <div className="leading-tight">
                            <p className="text-[11px] text-slate-500">Fees</p>
                            <MarketFees yesId={e.yesId ?? null} noId={e.noId ?? null} />
                          </div>
                        )}
                      </div>
                      {(e.probabilityYes != null || e.probabilityNo != null) && (
                        <div className="flex items-center gap-2">
                          <div className="min-w-[120px] flex flex-col gap-1.5">
                            <OrderBookLabel
                              tokenId={e.yesId ?? null}
                              probabilityYes={e.probabilityYes ?? null}
                              probabilityNo={e.probabilityNo ?? null}
                            />
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
                          <div className="flex shrink-0 gap-5">
                            <div className="flex flex-col gap-0.5">
                              {(e.yev != null || e.nev != null) && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-slate-500 w-[4.5rem]">YEV</span>
                                  <span className="font-mono text-sm text-emerald-500/90 tabular-nums min-w-[2.5rem] text-right">{(e.yev ?? 0).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-slate-500 w-[4.5rem]">Yes PAROI</span>
                                <span className="font-mono text-sm text-emerald-500/90 tabular-nums min-w-[2.5rem] text-right">
                                  {computePAROI(e.probabilityYes ?? (e.probabilityNo != null ? 1 - e.probabilityNo : 0), daysToResolution(e.endDate), e.yesSpread)}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-slate-500 w-[4.5rem]">Yes ROI</span>
                                <span className="font-mono text-sm text-emerald-500/90 tabular-nums min-w-[2.5rem] text-right">
                                  {computeROI(e.probabilityYes ?? (e.probabilityNo != null ? 1 - e.probabilityNo : 0), e.yesSpread)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {(e.yev != null || e.nev != null) && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-slate-500 w-[4.5rem]">NEV</span>
                                  <span className="font-mono text-sm text-red-500/90 tabular-nums min-w-[2.5rem] text-right">{(e.nev ?? 0).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-slate-500 w-[4.5rem]">No PAROI</span>
                                <span className="font-mono text-sm text-red-500/90 tabular-nums min-w-[2.5rem] text-right">
                                  {computePAROI(e.probabilityNo ?? (e.probabilityYes != null ? 1 - e.probabilityYes : 0), daysToResolution(e.endDate), e.noSpread)}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-slate-500 w-[4.5rem]">No ROI</span>
                                <span className="font-mono text-sm text-red-500/90 tabular-nums min-w-[2.5rem] text-right">
                                  {computeROI(e.probabilityNo ?? (e.probabilityYes != null ? 1 - e.probabilityYes : 0), e.noSpread)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {isKellyTab && kellyDef && (() => {
                      const def = kellyDef;
                      const pNum = parseFloat(def.p);
                      const cNum = parseFloat(def.c);
                      const quotedYes = e.probabilityYes ?? (e.probabilityNo != null ? 1 - e.probabilityNo : null);
                      const quotedNo = e.probabilityNo ?? (e.probabilityYes != null ? 1 - e.probabilityYes : null);
                      // Normalize to 0-1: if value > 1, assume it's stored as percent (0-100)
                      const toDec = (v: number | null | undefined) =>
                        v != null && Number.isFinite(v) ? (v > 1 ? v / 100 : v) : 0;
                      const qYes = quotedYes != null ? toDec(quotedYes) : null;
                      const qNo = quotedNo != null ? toDec(quotedNo) : null;
                      const spYes = toDec(e.yesSpread);
                      const spNo = toDec(e.noSpread);
                      const rawBuyPrice = def.position === "yes"
                        ? (qYes != null ? qYes + spYes : null)
                        : (qNo != null ? qNo + spNo : null);
                      const buyPrice = rawBuyPrice != null ? Math.min(0.99, rawBuyPrice) : null;
                      const pForKelly = def.position === "yes" ? (Number.isFinite(pNum) ? pNum / 100 : 0) : (Number.isFinite(pNum) ? 1 - pNum / 100 : 0);
                      const kellyResult = buyPrice != null && buyPrice > 0 && buyPrice < 1 && pForKelly > 0 && pForKelly < 1 && Number.isFinite(cNum) && cNum > 0
                        ? computeKellyCriterion(pForKelly, buyPrice, cNum)
                        : null;
                      const scheduleSave = (p: string, c: string, pos: "yes" | "no") => {
                        const prev = kellySaveTimersRef.current[e.id];
                        if (prev) clearTimeout(prev);
                        kellySaveTimersRef.current[e.id] = setTimeout(async () => {
                          const pVal = parseFloat(p);
                          const cVal = parseFloat(c);
                          if (Number.isFinite(pVal) && pVal >= 0 && pVal <= 100 && Number.isFinite(cVal) && cVal > 0) {
                            await handleSetKelly(e.id, pVal / 100, cVal, pos);
                          }
                          delete kellySaveTimersRef.current[e.id];
                        }, 400);
                      };
                      return (
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/30 px-2.5 py-1.5">
                      <button
                        type="button"
                        role="switch"
                        aria-label="Kelly position (YES or NO)"
                        title={`Entering ${def.position === "yes" ? "YES" : "NO"} — click to switch`}
                        onClick={() => {
                          const next = def.position === "yes" ? "no" : "yes";
                          setKellyDrafts((d) => ({ ...d, [e.id]: { ...def, position: next } }));
                          handleToggleKellyPosition(e.id);
                        }}
                        disabled={savingKellyId === e.id}
                        className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200 ${
                          def.position === "yes"
                            ? "bg-emerald-500/20 text-emerald-400 shadow-sm ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
                            : "bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/30 hover:bg-red-500/30"
                        } disabled:opacity-50`}
                      >
                        <span className="text-[10px] font-bold leading-tight">{def.position.toUpperCase()}</span>
                      </button>
                      <span className="text-xs text-slate-500 self-center">Kelly</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400"><span className="italic">p</span><sub>YES</sub></span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={def.p}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setKellyDrafts((d) => ({ ...d, [e.id]: { ...def, p: v } }));
                            scheduleSave(v, def.c, def.position);
                          }}
                          onBlur={() => {
                            const pVal = parseFloat(def.p);
                            const cVal = parseFloat(def.c);
                            if (Number.isFinite(pVal) && pVal >= 0 && pVal <= 100 && Number.isFinite(cVal) && cVal > 0) {
                              handleSetKelly(e.id, pVal / 100, cVal, def.position);
                            }
                          }}
                          placeholder={(e.traderAppraisedYes ?? e.appraisedYes) != null ? ((e.traderAppraisedYes ?? e.appraisedYes)! * 100).toString() : ""}
                          className="w-16 rounded border border-slate-600/60 bg-slate-900/50 px-2 py-1 text-xs font-mono text-beige"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">c</span>
                        <select
                          value={["1", "2", "4"].includes(def.c) ? def.c : "4"}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setKellyDrafts((d) => ({ ...d, [e.id]: { ...def, c: v } }));
                            scheduleSave(def.p, v, def.position);
                          }}
                          onBlur={() => {
                            const pVal = parseFloat(def.p);
                            const cVal = parseFloat(def.c);
                            if (Number.isFinite(pVal) && pVal >= 0 && pVal <= 100 && kellyCOptions.includes(cVal as 1 | 2 | 4)) {
                              handleSetKelly(e.id, pVal / 100, cVal, def.position);
                            }
                          }}
                          className="rounded border border-slate-600/60 bg-slate-900/50 px-2 py-1 text-xs font-mono text-beige"
                        >
                          {kellyCOptions.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      {kellyResult != null && (
                        <span className="font-mono text-sm font-medium text-amber-400/90 tabular-nums">
                          → {(kellyResult * 100).toFixed(1)}%
                          {portfolioSummary != null && portfolioSummary.portfolioValue > 0 && (
                            <>
                              {" · "}
                              {formatCompact(kellyResult * portfolioSummary.portfolioValue)}
                              {portfolioSummary.cash > 0 && (kellyResult * portfolioSummary.portfolioValue) > 0 && (
                                <> · Cash / {(portfolioSummary.cash / (kellyResult * portfolioSummary.portfolioValue)).toFixed(2)}</>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                      );
                    })()}
                    {isKellyTab && kellyDef && (e.yesId || e.noId) && (
                      <div className="mt-2">
                        <VolatilityDaysEstimate
                          asset={kellyDef.position}
                          onAssetChange={(pos) => {
                            setKellyDrafts((d) => ({ ...d, [e.id]: { ...kellyDef!, position: pos } }));
                            handleToggleKellyPosition(e.id);
                          }}
                          yesId={e.yesId}
                          noId={e.noId}
                          probabilityYes={e.probabilityYes ?? (e.probabilityNo != null ? 1 - e.probabilityNo : null)}
                          probabilityNo={e.probabilityNo ?? (e.probabilityYes != null ? 1 - e.probabilityYes : null)}
                          yesSpread={e.yesSpread}
                          noSpread={e.noSpread}
                          defaultTargetPrice={90}
                        />
                      </div>
                    )}
                    {activeTab !== "discovery" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                      {e.lastThinkAppraisalDurationSeconds != null && !appraisingIds.has(e.id) && (
                        <span className="text-xs text-slate-500 tabular-nums" title="Last think appraisal">
                          Think: {formatDurationSeconds(e.lastThinkAppraisalDurationSeconds)}
                        </span>
                      )}
                      <button
                        onClick={() => handleAppraise(e.id, "reappraise")}
                        disabled={appraisingIds.has(e.id) || e.lastAppraised == null}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-beige transition-colors hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {appraisingIds.has(e.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        Reappraise
                      </button>
                      {e.lastReappraisalDurationSeconds != null && !appraisingIds.has(e.id) && (
                        <span className="text-xs text-slate-500 tabular-nums" title="Last reappraisal">
                          Reappraise: {formatDurationSeconds(e.lastReappraisalDurationSeconds)}
                        </span>
                      )}
                      {appraisingIds.has(e.id) && (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/40 px-2.5 py-1.5 text-xs text-slate-400 tabular-nums">
                            <Clock className="h-3 w-3 shrink-0" />
                            {formatElapsed(e.id)}
                          </span>
                          <button
                            onClick={() => handleCancelAppraise(e.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/60 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </>
                      )}
                      {e.description && (
                        <button
                          onClick={() => setRulesPopupEventId(e.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/60"
                        >
                          <ScrollText className="h-3 w-3" />
                          Show rules
                        </button>
                      )}
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
                <div className="w-1/2 min-w-0 shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-400">{rightContent ? rightContent.title : "Market description"}</p>
                  <div className="max-h-56 overflow-y-auto pr-2 text-sm leading-relaxed">
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
          {totalTabPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-400 tabular-nums">
                Page {currentPage} of {totalTabPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalTabPages, p + 1))}
                disabled={currentPage >= totalTabPages}
                className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
        </div>
      )}

      {rulesPopupEventId && (() => {
        const ev = events.find((e) => e.id === rulesPopupEventId);
        if (!ev?.description) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setRulesPopupEventId(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-3">
                <h3 className="truncate font-medium text-beige">{ev.title}</h3>
                <button
                  onClick={() => setRulesPopupEventId(null)}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-beige"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-5">
                <ExplanationText text={ev.description} />
              </div>
            </div>
          </div>
        );
      })()}

    </>
  );
}
