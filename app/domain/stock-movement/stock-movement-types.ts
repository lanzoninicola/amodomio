export const STOCK_MOVEMENT_DIRECTION_VALUES = [
  "entry",
  "exit",
  "neutral",
] as const;

export type StockMovementDirection = (typeof STOCK_MOVEMENT_DIRECTION_VALUES)[number];

export const STOCK_MOVEMENT_TYPE_VALUES = [
  "import",
  "manual",
  "adjustment",
  "item-cost-sheet",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE_VALUES)[number];

export function normalizeStockMovementDirection(value: unknown): StockMovementDirection {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "exit") return "exit";
  if (normalized === "neutral") return "neutral";
  return "entry";
}

export function normalizeStockMovementType(value: unknown): StockMovementType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "manual") return "manual";
  if (normalized === "adjustment") return "adjustment";
  if (normalized === "item-cost-sheet") return "item-cost-sheet";
  return "import";
}

export function getStockMovementDirectionLabel(value: unknown) {
  const direction = normalizeStockMovementDirection(value);
  if (direction === "exit") return "saída";
  if (direction === "neutral") return "evento de custo";
  return "entrada";
}

export function getStockMovementTypeLabel(value: unknown) {
  const type = normalizeStockMovementType(value);
  if (type === "manual") return "manual";
  if (type === "adjustment") return "ajuste";
  if (type === "item-cost-sheet") return "ficha de custo";
  return "importação";
}

export function getDefaultDirectionForMovementType(value: unknown): StockMovementDirection {
  const type = normalizeStockMovementType(value);
  if (type === "import") return "entry";
  return "neutral";
}
