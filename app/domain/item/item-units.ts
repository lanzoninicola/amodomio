export const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

export function normalizeItemUnit(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}
