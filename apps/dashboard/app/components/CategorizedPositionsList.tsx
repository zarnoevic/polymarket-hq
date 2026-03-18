"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PositionCard, type Position } from "./PositionsList";
import { formatRoi, computeROINumeric } from "@/lib/position-metrics";
import { MetricTooltip } from "./MetricTooltip";
import { METRIC_TOOLTIPS } from "@/lib/metric-tooltips";
import { FolderPlus, GripVertical, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  fetchPositionCategories,
  savePositionCategories,
  UNCategorized_ID,
} from "@/lib/position-categories";

type Category = { id: string; name: string };

function daysToResolution(endDateStr: string, title?: string): number | null {
  let d: Date | null = null;
  if (endDateStr) {
    d = new Date(endDateStr);
    if (isNaN(d.getTime())) {
      const m = endDateStr.trim().replace(/,/g, "");
      const year = new Date().getFullYear();
      d = new Date(`${m} ${year}`);
      if (isNaN(d.getTime())) d = new Date(`${m} ${year + 1}`);
    }
  }
  const m = title?.match(/(?:by\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})/i);
  if (!d && m) {
    const year = new Date().getFullYear();
    d = new Date(`${m[1]} ${m[2]}, ${year}`);
    if (d < new Date()) d.setFullYear(year + 1);
  }
  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  const resUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((resUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return days > 0 ? Math.max(1, days) : null;
}

/** PROI (Present): simple (1 - buyPrice) / buyPrice, no annualization. */
function computePROINumeric(curPrice: number, spread?: number | null): number | null {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return null;
  const r = (1 - buyPrice) / buyPrice;
  return Number.isFinite(r) ? r : null;
}

function computePROINumericForSort(curPrice: number, spread?: number | null): number {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0 || buyPrice >= 1 || !Number.isFinite(buyPrice)) return -Infinity;
  const r = (1 - buyPrice) / buyPrice;
  return Number.isFinite(r) ? r : -Infinity;
}

function sortByPROI(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => {
    const proiA = computePROINumericForSort(a.curPrice, a.spread);
    const proiB = computePROINumericForSort(b.curPrice, b.spread);
    return proiB - proiA;
  });
}

function formatCompactUsd(value: number, decimals = 0): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function computeCategoryMetrics(posList: Position[]): {
  totalInitialValue: number;
  totalCurrentValue: number;
  totalReturn: number;
  returnPct: number | null;
  croi: string;
  proi: string;
} {
  if (posList.length === 0) {
    return { totalInitialValue: 0, totalCurrentValue: 0, totalReturn: 0, returnPct: null, croi: "—", proi: "—" };
  }
  const totalInitialValue = posList.reduce((s, p) => s + Math.abs(p.initialValue), 0);
  const totalCurrentValue = posList.reduce((s, p) => s + Math.abs(p.currentValue), 0);
  const totalReturn = posList.reduce((s, p) => s + p.cashPnl, 0);
  const returnPct =
    totalInitialValue > 0 && Number.isFinite(totalReturn / totalInitialValue)
      ? (totalReturn / totalInitialValue) * 100
      : null;
  let croiSum = 0;
  let croiWeight = 0;
  let proiSum = 0;
  let proiWeight = 0;
  for (const pos of posList) {
    const val = Math.abs(pos.currentValue);
    if (val <= 0) continue;
    const cro = computeROINumeric(pos.avgPrice, pos.spread); // CROI = (1 - buyPrice) / buyPrice at entry
    const pro = computePROINumeric(pos.curPrice, pos.spread);
    if (cro != null) {
      croiSum += cro * val;
      croiWeight += val;
    }
    if (pro != null) {
      proiSum += pro * val;
      proiWeight += val;
    }
  }
  const croi = croiWeight > 0 ? formatRoi(croiSum / croiWeight) : "—";
  const proi = proiWeight > 0 ? formatRoi(proiSum / proiWeight) : "—";
  return { totalInitialValue, totalCurrentValue, totalReturn, returnPct, croi, proi };
}

export function CategorizedPositionsList({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet?: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [positionToCategory, setPositionToCategory] = useState<Record<string, string>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/dashboard/refresh", { method: "POST" });
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPositionCategories(wallet)
      .then((stored) => {
        if (!cancelled) {
          setCategories(stored.categories);
          setPositionToCategory(stored.positionToCategory);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
          setPositionToCategory({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const persist = useCallback(
    async (cats: Category[], map: Record<string, string>) => {
      try {
        await savePositionCategories({ categories: cats, positionToCategory: map }, wallet);
      } catch {
        // ignore save errors
      }
    },
    [wallet]
  );

  const assignPosition = (asset: string, categoryId: string) => {
    const next = { ...positionToCategory };
    if (categoryId === UNCategorized_ID) {
      delete next[asset];
    } else {
      next[asset] = categoryId;
    }
    setPositionToCategory(next);
    persist(categories, next);
  };

  const addCategory = () => {
    const name = newCategoryName.trim() || "New category";
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next = [...categories, { id, name }];
    setCategories(next);
    setNewCategoryName("");
    setAddMode(false);
    persist(next, positionToCategory);
  };

  const updateCategory = (id: string, name: string) => {
    const next = categories.map((c) => (c.id === id ? { ...c, name } : c));
    setCategories(next);
    setEditingCategoryId(null);
    persist(next, positionToCategory);
  };

  const removeCategory = (id: string) => {
    const next = categories.filter((c) => c.id !== id);
    const nextMap = { ...positionToCategory };
    for (const asset of Object.keys(nextMap)) {
      if (nextMap[asset] === id) delete nextMap[asset];
    }
    setCategories(next);
    setPositionToCategory(nextMap);
    persist(next, nextMap);
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingCategoryId(id);
    setEditingName(currentName);
  };

  const confirmEdit = () => {
    if (editingCategoryId) {
      const name = (editingName.trim() || categories.find((c) => c.id === editingCategoryId)?.name) ?? "Category";
      updateCategory(editingCategoryId, name);
    }
  };

  const onDrop = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    setDragOverCategoryId(null);
    const asset = e.dataTransfer.getData("text/asset");
    if (asset) assignPosition(asset, categoryId);
  };

  const onDragEnter = (e: React.DragEvent, categoryId: string) => {
    if (e.dataTransfer.types.includes("text/asset")) {
      setDragOverCategoryId(categoryId);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCategoryId(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDragStart = (e: React.DragEvent, asset: string) => {
    e.dataTransfer.setData("text/asset", asset);
    e.dataTransfer.effectAllowed = "move";
  };

  const posByCategory = new Map<string, Position[]>();
  for (const pos of positions) {
    const catId =
      positionToCategory[pos.asset] ??
      positionToCategory[pos.yesId ?? ""] ??
      UNCategorized_ID;
    const list = posByCategory.get(catId) ?? [];
    list.push(pos);
    posByCategory.set(catId, list);
  }

  const uncategorizedCount = posByCategory.get(UNCategorized_ID)?.length ?? 0;
  const categoryList: { id: string; name: string }[] = [
    ...categories,
    ...(uncategorizedCount > 0 ? [{ id: UNCategorized_ID, name: "Uncategorized" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        {addMode ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") setAddMode(false);
              }}
              placeholder="Category name"
              className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={addCategory}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Add
            </button>
            <button
              onClick={() => setAddMode(false)}
              className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-indigo-600/50 hover:bg-slate-800 hover:text-indigo-400"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Add category
          </button>
        )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-indigo-600/50 hover:bg-slate-800 hover:text-indigo-400 disabled:opacity-60"
          title="Refresh data (positions, cash, account)"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {categoryList.map((cat) => {
        const posList = sortByPROI(posByCategory.get(cat.id) ?? []);
        const metrics = computeCategoryMetrics(posList);
        const isUncategorized = cat.id === UNCategorized_ID;

        const isDragOver = dragOverCategoryId === cat.id;
        return (
          <div
            key={cat.id}
            className={`rounded-xl border transition-all duration-150 ${isDragOver ? "border-indigo-500/80 bg-indigo-500/10 ring-2 ring-indigo-500/40" : "border-slate-800/60 bg-slate-900/30"}`}
            onDragOver={onDragOver}
            onDragEnter={(e) => onDragEnter(e, cat.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, cat.id)}
          >
            <div className="flex items-center gap-2 border-b border-slate-800/60 px-3 py-2">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-600" />
              {editingCategoryId === cat.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit();
                      if (e.key === "Escape") setEditingCategoryId(null);
                    }}
                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={confirmEdit}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-medium text-slate-300">{cat.name}</h3>
                  <span className="text-xs text-slate-500">({posList.length})</span>
                  {posList.length > 0 && (
                    <div className="ml-3 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                      <span className="font-mono text-slate-400">
                        {formatCompactUsd(metrics.totalInitialValue, 0)} →{" "}
                        {formatCompactUsd(metrics.totalCurrentValue, 0)}
                      </span>
                      <span
                        className={`font-mono ${metrics.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {metrics.totalReturn >= 0 ? "+" : ""}
                        {formatCompactUsd(metrics.totalReturn, 0)}
                        {metrics.returnPct != null && (
                          <>
                            {" "}
                            ({metrics.returnPct >= 0 ? "+" : ""}
                            {metrics.returnPct.toFixed(1)}%)
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-slate-400">
                        <MetricTooltip
                          content={`CROI (entry): ${METRIC_TOOLTIPS.CROI}\n\nPROI (current): ${METRIC_TOOLTIPS.PROI}`}
                          trigger="ROI"
                        />{" "}
                        {metrics.croi} → {metrics.proi}
                      </span>
                    </div>
                  )}
                  {!isUncategorized && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => startEdit(cat.id, cat.name)}
                        className="rounded p-0.5 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="rounded p-0.5 text-slate-500 hover:bg-red-900/30 hover:text-red-400"
                        title="Delete category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2 p-2">
              {posList.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed text-center text-xs transition-all ${
                    isDragOver
                      ? "min-h-[72px] border-indigo-500/60 bg-indigo-500/5 py-8 text-indigo-400/80"
                      : "border-slate-700/60 py-6 text-slate-500"
                  }`}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, cat.id)}
                >
                  {isDragOver ? "Drop here" : "Drag positions here"}
                </div>
              ) : (
                posList.map((pos) => (
                  <div key={pos.asset}>
                    <PositionCard
                      position={pos}
                      draggable
                      onDragStart={onDragStart}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
