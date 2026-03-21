import prismaClient from "~/lib/prisma/client.server";
import {
  calculateItemCostMetrics,
  getItemAverageCostWindowDays,
  isItemCostExcludedFromMetrics,
  normalizeItemCostToConsumptionUnit,
} from "~/domain/item/item-cost-metrics.server";

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

type CostRowLike = {
  id?: string | null;
  costAmount?: number | null;
  unit?: string | null;
  validFrom?: Date | string | null;
  createdAt?: Date | string | null;
  source?: string | null;
  metadata?: unknown;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function pickPrimaryItemVariation(item: any) {
  const activeVariations = (item?.ItemVariation || []).filter((row: any) => !row?.deletedAt);
  return activeVariations.find((row: any) => row.isReference) || activeVariations[0] || null;
}

function buildTrendData(params: {
  history: CostRowLike[];
  item: any;
  chartWindowDays: number;
}) {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (params.chartWindowDays - 1));

  const buckets = new Map<string, { date: string; label: string; total: number; count: number }>();

  for (const row of params.history) {
    if (isItemCostExcludedFromMetrics(row)) continue;

    const date = toDate(row.validFrom) || toDate(row.createdAt);
    if (!date || date < threshold) continue;

    const normalizedAmount = normalizeItemCostToConsumptionUnit(row, params.item);
    const amount = Number.isFinite(normalizedAmount) ? normalizedAmount : Number(row.costAmount ?? NaN);
    if (!Number.isFinite(amount) || amount < 0) continue;

    const dateKey = date.toISOString().slice(0, 10);
    const bucket = buckets.get(dateKey) || {
      date: dateKey,
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: 0,
      count: 0,
    };

    bucket.total += amount;
    bucket.count += 1;
    buckets.set(dateKey, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      value: bucket.count > 0 ? bucket.total / bucket.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadItemCostMonitoringPayload(request: Request) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const classificationParam = String(url.searchParams.get("classification") || "").trim();
  const classification = ITEM_CLASSIFICATIONS.includes(classificationParam as (typeof ITEM_CLASSIFICATIONS)[number])
    ? classificationParam
    : "insumo";
  const averageWindowDays = await getItemAverageCostWindowDays();
  const chartWindowDays = Math.max(averageWindowDays, 60);

  if (!q) {
    return {
      filters: { q: "", classification },
      averageWindowDays,
      chartWindowDays,
      items: [],
    };
  }

  const items = await db.item.findMany({
    where: {
      active: true,
      classification,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      ItemVariation: {
        where: { deletedAt: null },
        include: {
          ItemCostVariation: {
            select: {
              id: true,
              costAmount: true,
              unit: true,
              validFrom: true,
              createdAt: true,
              source: true,
            },
          },
          ItemCostVariationHistory: {
            select: {
              id: true,
              costAmount: true,
              unit: true,
              validFrom: true,
              createdAt: true,
              source: true,
              metadata: true,
            },
            orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
            take: 90,
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ name: "asc" }],
    take: 20,
  });

  return {
    filters: { q, classification },
    averageWindowDays,
    chartWindowDays,
    items: items.map((item: any) => {
      const baseVariation = pickPrimaryItemVariation(item);
      const history = baseVariation?.ItemCostVariationHistory || [];
      const currentCost = baseVariation?.ItemCostVariation || null;
      const historyForMetrics = history.length > 0 ? history : currentCost ? [currentCost] : [];
      const metrics = calculateItemCostMetrics({
        item,
        history: historyForMetrics,
        averageWindowDays,
      });

      const suppliersMap = new Map<string, CostRowLike>();
      for (const row of history) {
        const supplierName = getSupplierNameFromMetadata(row?.metadata);
        if (!supplierName) continue;

        const existing = suppliersMap.get(supplierName);
        const rowDate = (toDate(row.validFrom) || toDate(row.createdAt) || new Date(0)).getTime();
        const existingDate = existing
          ? (toDate(existing.validFrom) || toDate(existing.createdAt) || new Date(0)).getTime()
          : Number.NEGATIVE_INFINITY;

        if (!existing || rowDate > existingDate) {
          suppliersMap.set(supplierName, row);
        }
      }

      const suppliers = Array.from(suppliersMap.entries())
        .map(([supplierName, row]) => ({
          supplierName,
          costAmount: Number(row?.costAmount || 0),
          normalizedCostAmount: normalizeItemCostToConsumptionUnit(row, item),
          unit: row?.unit || item.purchaseUm || item.consumptionUm || null,
          validFrom: row?.validFrom || row?.createdAt || null,
          source: row?.source || null,
        }))
        .sort((a, b) => {
          const aDate = (toDate(a.validFrom) || new Date(0)).getTime();
          const bDate = (toDate(b.validFrom) || new Date(0)).getTime();
          return bDate - aDate;
        });

      const trend = buildTrendData({
        history: history.length > 0 ? history : currentCost ? [currentCost] : [],
        item,
        chartWindowDays,
      });

      return {
        id: item.id,
        name: item.name,
        consumptionUm: item.consumptionUm,
        purchaseUm: item.purchaseUm,
        trendUnit: item.consumptionUm || item.purchaseUm || currentCost?.unit || null,
        latestCost: metrics.latestCost
          ? {
              costAmount: Number(metrics.latestCost.costAmount || 0),
              normalizedCostAmount: metrics.latestCostPerConsumptionUnit,
              unit: metrics.latestCost.unit || item.purchaseUm || item.consumptionUm || null,
              validFrom: metrics.latestCost.validFrom || metrics.latestCost.createdAt || null,
              source: metrics.latestCost.source || null,
            }
          : null,
        averageCostPerConsumptionUnit: metrics.averageCostPerConsumptionUnit,
        averageSamplesCount: metrics.averageSamplesCount,
        suppliers,
        trend,
      };
    }),
  };
}
