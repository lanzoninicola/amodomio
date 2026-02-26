import prismaClient from "~/lib/prisma/client.server";

export const ITEM_COST_SETTINGS_CONTEXT = "items.cost";
export const ITEM_COST_AVERAGE_WINDOW_DAYS_SETTING = "averageWindowDays";
export const DEFAULT_ITEM_COST_AVERAGE_WINDOW_DAYS = 30;

type ItemMeasurementLike = {
  purchaseUm?: string | null;
  consumptionUm?: string | null;
  purchaseToConsumptionFactor?: number | null;
};

type ItemCostHistoryLike = {
  costAmount?: number | null;
  unit?: string | null;
  validFrom?: Date | string | null;
  createdAt?: Date | string | null;
  source?: string | null;
};

export type ItemCostMetrics = {
  averageWindowDays: number;
  latestCost: ItemCostHistoryLike | null;
  latestCostPerConsumptionUnit: number | null;
  averageCostPerConsumptionUnit: number | null;
  averageSamplesCount: number;
};

function normalizeUm(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase() || null;
}

function normalizeCostToConsumptionUnit(
  cost: ItemCostHistoryLike,
  measurement: ItemMeasurementLike
): number | null {
  const amount = Number(cost.costAmount ?? NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const costUnit = normalizeUm(cost.unit);
  const purchaseUm = normalizeUm(measurement.purchaseUm);
  const consumptionUm = normalizeUm(measurement.consumptionUm);
  const factor = Number(measurement.purchaseToConsumptionFactor ?? NaN);

  if (!consumptionUm) {
    return amount;
  }

  // Item cost sheet snapshots may arrive already normalized.
  const source = String(cost.source || "").trim().toLowerCase();
  if (!costUnit && source === "item-cost-sheet") {
    return amount;
  }

  if (costUnit === consumptionUm) {
    return amount;
  }

  if (costUnit && purchaseUm && costUnit === purchaseUm && Number.isFinite(factor) && factor > 0) {
    return amount / factor;
  }

  return null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getItemAverageCostWindowDays() {
  const setting = await prismaClient.setting.findFirst({
    where: {
      context: ITEM_COST_SETTINGS_CONTEXT,
      name: ITEM_COST_AVERAGE_WINDOW_DAYS_SETTING,
    },
    orderBy: [{ createdAt: "desc" }],
    select: { value: true },
  });

  const parsed = Number(setting?.value ?? DEFAULT_ITEM_COST_AVERAGE_WINDOW_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ITEM_COST_AVERAGE_WINDOW_DAYS;
  }
  return Math.round(parsed);
}

export function calculateItemCostMetrics(params: {
  item: ItemMeasurementLike;
  history: ItemCostHistoryLike[];
  averageWindowDays: number;
  now?: Date;
}): ItemCostMetrics {
  const now = params.now ?? new Date();
  const averageWindowDays = Math.max(1, Math.round(params.averageWindowDays || 1));
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - averageWindowDays);

  const history = [...(params.history || [])].sort((a, b) => {
    const aDate = toDate(a.validFrom) ?? toDate(a.createdAt) ?? new Date(0);
    const bDate = toDate(b.validFrom) ?? toDate(b.createdAt) ?? new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  const latestCost = history[0] ?? null;
  const latestCostPerConsumptionUnit = latestCost
    ? normalizeCostToConsumptionUnit(latestCost, params.item)
    : null;

  const normalizedInWindow = history
    .filter((row) => {
      const d = toDate(row.validFrom) ?? toDate(row.createdAt);
      return d ? d >= threshold : false;
    })
    .map((row) => normalizeCostToConsumptionUnit(row, params.item))
    .filter((value): value is number => Number.isFinite(value as number));

  const averageCostPerConsumptionUnit =
    normalizedInWindow.length > 0
      ? normalizedInWindow.reduce((acc, v) => acc + v, 0) / normalizedInWindow.length
      : null;

  return {
    averageWindowDays,
    latestCost,
    latestCostPerConsumptionUnit,
    averageCostPerConsumptionUnit,
    averageSamplesCount: normalizedInWindow.length,
  };
}
