"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PositionCard, type Position } from "./PositionsList";
import { FolderPlus, GripVertical, Pencil, Trash2, RefreshCw } from "lucide-react";

const UNCategorized_ID = "__uncategorized__";
const STORAGE_KEY = "polymarket-position-categories";

type Category = { id: string; name: string };
type StoredData = {
  categories: Category[];
  positionToCategory: Record<string, string>;
};

function loadStored(wallet?: string): StoredData {
  if (typeof window === "undefined")
    return { categories: [], positionToCategory: {} };
  try {
    const key = wallet ? `${STORAGE_KEY}-${wallet}` : STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return { categories: [], positionToCategory: {} };
    const parsed = JSON.parse(raw) as StoredData;
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      positionToCategory: parsed.positionToCategory && typeof parsed.positionToCategory === "object" ? parsed.positionToCategory : {},
    };
  } catch {
    return { categories: [], positionToCategory: {} };
  }
}

function saveStored(data: StoredData, wallet?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = wallet ? `${STORAGE_KEY}-${wallet}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

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

function computePAROINumeric(curPrice: number, days: number | null, spread?: number | null): number {
  const buyPrice = Math.min(0.99, curPrice + (spread ?? 0));
  if (buyPrice <= 0) return -Infinity;
  if (days == null || days <= 0) return -Infinity;
  const r = (1 - buyPrice) / buyPrice;
  return r * (365 / days);
}

function sortByPAROI(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => {
    const daysA = daysToResolution(a.endDate, a.title);
    const daysB = daysToResolution(b.endDate, b.title);
    const paroiA = computePAROINumeric(a.curPrice, daysA, a.spread);
    const paroiB = computePAROINumeric(b.curPrice, daysB, b.spread);
    return paroiB - paroiA;
  });
}

export function CategorizedPositionsList({
  positions,
  wallet,
}: {
  positions: Position[];
  wallet?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [positionToCategory, setPositionToCategory] = useState<Record<string, string>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStored(wallet);
    setCategories(stored.categories);
    setPositionToCategory(stored.positionToCategory);
  }, [wallet]);

  const persist = useCallback(
    (cats: Category[], map: Record<string, string>) => {
      saveStored({ categories: cats, positionToCategory: map }, wallet);
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
    const catId = positionToCategory[pos.asset] ?? UNCategorized_ID;
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
          onClick={() => router.refresh()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-indigo-600/50 hover:bg-slate-800 hover:text-indigo-400"
          title="Refresh data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {categoryList.map((cat) => {
        const posList = sortByPAROI(posByCategory.get(cat.id) ?? []);
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
