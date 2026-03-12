export const UNCategorized_ID = "__uncategorized__";
export const STORAGE_KEY = "polymarket-position-categories";

export type StoredCategoryData = {
  categories: { id: string; name: string }[];
  positionToCategory: Record<string, string>;
};

export function loadPositionCategories(wallet?: string): StoredCategoryData {
  if (typeof window === "undefined")
    return { categories: [], positionToCategory: {} };
  try {
    const key = wallet ? `${STORAGE_KEY}-${wallet}` : STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return { categories: [], positionToCategory: {} };
    const parsed = JSON.parse(raw) as StoredCategoryData;
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      positionToCategory:
        parsed.positionToCategory && typeof parsed.positionToCategory === "object"
          ? parsed.positionToCategory
          : {},
    };
  } catch {
    return { categories: [], positionToCategory: {} };
  }
}
