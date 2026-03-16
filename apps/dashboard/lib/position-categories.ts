export const UNCategorized_ID = "__uncategorized__";
const STORAGE_KEY = "polymarket-position-categories";

export type StoredCategoryData = {
  categories: { id: string; name: string }[];
  positionToCategory: Record<string, string>;
};

/** Load from localStorage (used for one-time migration when DB is empty) */
function loadFromLocalStorage(wallet?: string): StoredCategoryData | null {
  if (typeof window === "undefined") return null;
  try {
    const key = wallet ? `${STORAGE_KEY}-${wallet}` : STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCategoryData;
    const data: StoredCategoryData = {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      positionToCategory:
        parsed.positionToCategory && typeof parsed.positionToCategory === "object"
          ? parsed.positionToCategory
          : {},
    };
    if (data.categories.length === 0 && Object.keys(data.positionToCategory).length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Clear localStorage for a wallet (after migrating to DB) */
export function clearPositionCategoriesLocalStorage(wallet?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = wallet ? `${STORAGE_KEY}-${wallet}` : STORAGE_KEY;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Fetch categories from the database via API. Migrates from localStorage if DB is empty. */
export async function fetchPositionCategories(
  wallet?: string
): Promise<StoredCategoryData> {
  const w = (wallet ?? "").trim().toLowerCase() || "default";
  const url = `/api/categories?wallet=${encodeURIComponent(w)}`;
  let data: StoredCategoryData;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch categories: ${res.status}`);
    }
    const json = (await res.json()) as StoredCategoryData;
    data = {
      categories: Array.isArray(json.categories) ? json.categories : [],
      positionToCategory:
        json.positionToCategory && typeof json.positionToCategory === "object"
          ? json.positionToCategory
          : {},
    };
  } catch {
    // On fetch error, fall back to localStorage (may have old data)
    const stored = loadFromLocalStorage(wallet);
    return stored ?? { categories: [], positionToCategory: {} };
  }

  // One-time migration: if DB is empty and localStorage has data, migrate to DB
  const dbEmpty = data.categories.length === 0 && Object.keys(data.positionToCategory).length === 0;
  const stored = loadFromLocalStorage(wallet);
  if (dbEmpty && stored) {
    try {
      await savePositionCategories(stored, wallet);
      clearPositionCategoriesLocalStorage(wallet);
      return stored;
    } catch {
      return data;
    }
  }

  return data;
}

/** Save categories to the database via API */
export async function savePositionCategories(
  data: StoredCategoryData,
  wallet?: string
): Promise<void> {
  const w = (wallet ?? "").trim().toLowerCase() || "default";
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: w,
      categories: data.categories,
      positionToCategory: data.positionToCategory,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `Failed to save categories: ${res.status}`
    );
  }
}

