import prismaClient from "~/lib/prisma/client.server";
import { capitalizeSupplierName } from "~/domain/supplier/supplier.prisma.entity.server";
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

export async function loadSupplierItemCostsPayload(request: Request) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const supplierName = String(url.searchParams.get("supplier") || "").trim();

  const allSuppliers = (
    await db.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((s: { id: string; name: string }) => ({
    ...s,
    name: capitalizeSupplierName(s.name),
  }));

  if (!supplierName) {
    return { supplierName: "", suppliers: allSuppliers, items: [] };
  }

  // Fetch history rows matching the supplier name in metadata (PostgreSQL JSON path filter)
  const historyRows = await db.itemCostVariationHistory.findMany({
    where: {
      metadata: {
        path: ["supplierName"],
        string_contains: supplierName,
      },
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      itemVariationId: true,
      costAmount: true,
      unit: true,
      validFrom: true,
      createdAt: true,
      metadata: true,
      ItemVariation: {
        select: {
          id: true,
          isReference: true,
          Item: {
            select: {
              id: true,
              name: true,
              active: true,
              purchaseUm: true,
              consumptionUm: true,
              purchaseToConsumptionFactor: true,
            },
          },
        },
      },
    },
  });

  // JS-level filter for case-insensitive match (safety net)
  const supplierLower = supplierName.toLowerCase();
  const filteredRows = historyRows.filter((row: any) => {
    const sn = getSupplierNameFromMetadata(row.metadata);
    return sn && sn.toLowerCase().includes(supplierLower);
  });

  // Collect unique active item IDs
  const itemIdSet = new Set<string>();
  for (const row of filteredRows) {
    const item = row.ItemVariation?.Item;
    if (item?.active && item.id) itemIdSet.add(item.id);
  }

  const uniqueItemIds = Array.from(itemIdSet);

  if (uniqueItemIds.length === 0) {
    return { supplierName, suppliers: allSuppliers, items: [] };
  }

  // Fetch items with full history to compare all suppliers
  const items = await db.item.findMany({
    where: { id: { in: uniqueItemIds }, active: true },
    include: {
      ItemVariation: {
        where: { deletedAt: null },
        include: {
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
  });

  return {
    supplierName,
    suppliers: allSuppliers,
    items: items.map((item: any) => {
      const baseVariation = pickPrimaryItemVariation(item);
      const history: CostRowLike[] = baseVariation?.ItemCostVariationHistory || [];

      // This supplier's latest cost
      const thisRows = history.filter((row) => {
        const sn = getSupplierNameFromMetadata(row.metadata);
        return sn && sn.toLowerCase().includes(supplierLower);
      });
      const thisLatest = thisRows[0] || null;

      // Other suppliers' latest cost (one entry per supplier name)
      const othersMap = new Map<string, CostRowLike>();
      for (const row of history) {
        const sn = getSupplierNameFromMetadata(row.metadata);
        if (!sn || sn.toLowerCase().includes(supplierLower)) continue;
        if (!othersMap.has(sn)) othersMap.set(sn, row);
      }

      const otherSuppliers = Array.from(othersMap.entries())
        .map(([sn, row]) => ({
          supplierName: sn,
          costAmount: Number(row.costAmount || 0),
          unit: row.unit || item.purchaseUm || item.consumptionUm || null,
          validFrom: row.validFrom || row.createdAt || null,
        }))
        .sort((a, b) => b.costAmount - a.costAmount); // most expensive first

      return {
        id: item.id,
        name: item.name,
        consumptionUm: item.consumptionUm,
        purchaseUm: item.purchaseUm,
        thisSupplierCost: thisLatest
          ? {
              costAmount: Number(thisLatest.costAmount || 0),
              unit: thisLatest.unit || item.purchaseUm || item.consumptionUm || null,
              validFrom: thisLatest.validFrom || thisLatest.createdAt || null,
            }
          : null,
        otherSuppliers,
      };
    }),
  };
}

function str(value: unknown) {
  return String(value || "").trim();
}

function toDateTime(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getImportBatchIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const batchId = str((metadata as Record<string, unknown>).importBatchId);
  if (batchId) return batchId;
  return str((metadata as Record<string, unknown>).rollbackOfBatchId) || null;
}

export async function listItemCostHistoryTimeline(params: {
  q?: string;
  supplier?: string;
  item?: string;
  from?: Date | null;
  to?: Date | null;
}) {
  const db = prismaClient as any;
  if (typeof db.itemCostVariationHistory?.findMany !== "function") {
    return [];
  }

  const where: any = {};
  const q = str(params.q);
  const supplier = str(params.supplier);
  const item = str(params.item);

  if (params.from || params.to) {
    where.validFrom = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  if (item) {
    where.ItemVariation = {
      is: {
        Item: {
          is: {
            name: { contains: item, mode: "insensitive" },
          },
        },
      },
    };
  }

  const historyRows = await db.itemCostVariationHistory.findMany({
    where,
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    include: {
      ItemVariation: {
        select: {
          id: true,
          isReference: true,
          Item: {
            select: {
              id: true,
              name: true,
              classification: true,
            },
          },
        },
      },
    },
  });

  const filteredHistoryRows = historyRows.filter((row: any) => {
    const supplierName = getSupplierNameFromMetadata(row?.metadata);
    const invoiceNumber =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? str((row.metadata as any).invoiceNumber)
        : "";
    const itemName = str(row?.ItemVariation?.Item?.name);

    if (supplier && !String(supplierName || "").toLowerCase().includes(supplier.toLowerCase())) return false;
    if (
      q &&
      ![itemName, String(supplierName || ""), invoiceNumber].some((value) =>
        value.toLowerCase().includes(q.toLowerCase()),
      )
    ) {
      return false;
    }

    return true;
  });

  const importBatchIds = Array.from(
    new Set(filteredHistoryRows.map((row: any) => getImportBatchIdFromMetadata(row?.metadata)).filter(Boolean)),
  );

  const importBatches = importBatchIds.length > 0 && typeof db.stockMovementImportBatch?.findMany === "function"
    ? await db.stockMovementImportBatch.findMany({
      where: { id: { in: importBatchIds } },
      select: { id: true, name: true },
    })
    : [];

  const batchMap = new Map(importBatches.map((batch: any) => [String(batch.id), batch]));
  const currentRows = filteredHistoryRows.length > 0
    ? await db.itemCostVariation.findMany({
      where: {
        itemVariationId: {
          in: Array.from(new Set(filteredHistoryRows.map((row: any) => String(row.itemVariationId || "")).filter(Boolean))),
        },
        deletedAt: null,
      },
      select: {
        itemVariationId: true,
        costAmount: true,
        source: true,
        referenceType: true,
        referenceId: true,
        validFrom: true,
        updatedAt: true,
      },
    })
    : [];

  const currentMap = new Map(
    currentRows.map((row: any) => [String(row.itemVariationId), `${str(row.referenceType)}::${str(row.referenceId)}`]),
  );

  return filteredHistoryRows.map((row: any) => {
    const metadata = row?.metadata || null;
    const importBatchId = getImportBatchIdFromMetadata(metadata);
    const current = currentRows.find((entry: any) => String(entry.itemVariationId) === String(row.itemVariationId || ""));
    const currentKey = currentMap.get(String(row.itemVariationId || ""));
    const rowKey = `${str(row.referenceType)}::${str(row.referenceId)}`;
    const rowValidFrom = toDateTime(row.validFrom)?.getTime() || null;
    const currentValidFrom = toDateTime(current?.validFrom)?.getTime() || null;
    const isFallbackCurrentMatch =
      !str(row.referenceType) &&
      !str(row.referenceId) &&
      !str(current?.referenceType) &&
      !str(current?.referenceId) &&
      Number(current?.costAmount) === Number(row.costAmount) &&
      str(current?.source) === str(row.source) &&
      currentValidFrom != null &&
      rowValidFrom != null &&
      currentValidFrom === rowValidFrom;
    return {
      id: row.id,
      itemVariationId: row.itemVariationId,
      itemId: row.ItemVariation?.Item?.id || null,
      itemName: row.ItemVariation?.Item?.name || "Item sem nome",
      itemClassification: row.ItemVariation?.Item?.classification || null,
      costAmount: row.costAmount,
      previousCostAmount: row.previousCostAmount,
      unit: row.unit,
      source: row.source,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      validFrom: row.validFrom,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      metadata,
      supplierName: getSupplierNameFromMetadata(metadata),
      invoiceNumber: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? str((metadata as any).invoiceNumber) || null : null,
      importBatchId,
      Batch: importBatchId ? batchMap.get(importBatchId) || null : null,
      isCurrent: currentKey === rowKey || isFallbackCurrentMatch,
      effectiveAt: toDateTime(row.validFrom) || toDateTime(row.createdAt),
    };
  });
}
