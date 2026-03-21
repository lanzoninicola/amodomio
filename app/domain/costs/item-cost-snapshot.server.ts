import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import {
  calculateItemCostMetrics,
  getItemAverageCostWindowDays,
} from "~/domain/item/item-cost-metrics.server";

export type ItemCostSnapshot = {
  itemVariationId: string | null;
  lastUnitCostAmount: number;
  avgUnitCostAmount: number;
  averageWindowDays: number;
  historyCount: number;
};

async function findTargetItemVariation(params: {
  db: any;
  itemId?: string | null;
  variationId?: string | null;
  itemVariationId?: string | null;
}) {
  const { db } = params;

  if (params.itemVariationId) {
    return await db.itemVariation.findUnique({
      where: { id: params.itemVariationId },
      include: {
        Item: {
          select: {
            id: true,
            purchaseUm: true,
            consumptionUm: true,
            purchaseToConsumptionFactor: true,
          },
        },
        ItemCostVariation: {
          select: {
            costAmount: true,
            unit: true,
            validFrom: true,
            createdAt: true,
            source: true,
          },
        },
        ItemCostVariationHistory: {
          select: {
            costAmount: true,
            unit: true,
            validFrom: true,
            createdAt: true,
            source: true,
            metadata: true,
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          take: 100,
        },
      },
    });
  }

  const itemId = String(params.itemId || "").trim();
  if (!itemId) return null;

  if (params.variationId) {
    const linked = await itemVariationPrismaEntity.linkToItem({
      itemId,
      variationId: params.variationId,
    });

    return await db.itemVariation.findUnique({
      where: { id: linked.id },
      include: {
        Item: {
          select: {
            id: true,
            purchaseUm: true,
            consumptionUm: true,
            purchaseToConsumptionFactor: true,
          },
        },
        ItemCostVariation: {
          select: {
            costAmount: true,
            unit: true,
            validFrom: true,
            createdAt: true,
            source: true,
          },
        },
        ItemCostVariationHistory: {
          select: {
            costAmount: true,
            unit: true,
            validFrom: true,
            createdAt: true,
            source: true,
            metadata: true,
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          take: 100,
        },
      },
    });
  }

  return await db.itemVariation.findFirst({
    where: { itemId, deletedAt: null },
    include: {
      Item: {
        select: {
          id: true,
          purchaseUm: true,
          consumptionUm: true,
          purchaseToConsumptionFactor: true,
        },
      },
      ItemCostVariation: {
        select: {
          costAmount: true,
          unit: true,
          validFrom: true,
          createdAt: true,
          source: true,
        },
      },
      ItemCostVariationHistory: {
        select: {
          costAmount: true,
          unit: true,
          validFrom: true,
          createdAt: true,
          source: true,
          metadata: true,
        },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        take: 100,
      },
      Variation: {
        select: { kind: true, code: true },
      },
    },
    orderBy: [{ isReference: "desc" }, { createdAt: "asc" }],
  });
}

export async function resolveItemCostSnapshot(params: {
  db: any;
  itemId?: string | null;
  variationId?: string | null;
  itemVariationId?: string | null;
  now?: Date;
}): Promise<ItemCostSnapshot> {
  const target = await findTargetItemVariation(params);
  const averageWindowDays = await getItemAverageCostWindowDays();

  if (!target?.id || !target.Item) {
    return {
      itemVariationId: null,
      lastUnitCostAmount: 0,
      avgUnitCostAmount: 0,
      averageWindowDays,
      historyCount: 0,
    };
  }

  const currentCost = target.ItemCostVariation;
  const historyRows = Array.isArray(target.ItemCostVariationHistory)
    ? target.ItemCostVariationHistory
    : [];
  const historyForMetrics =
    historyRows.length > 0 ? historyRows : currentCost ? [currentCost] : [];

  const metrics = calculateItemCostMetrics({
    item: target.Item,
    history: historyForMetrics,
    averageWindowDays,
    now: params.now,
  });

  const lastUnitCostAmount = Number(metrics.latestCostPerConsumptionUnit ?? 0);
  const avgUnitCostAmount = Number(
    metrics.averageCostPerConsumptionUnit ??
      metrics.latestCostPerConsumptionUnit ??
      0
  );

  return {
    itemVariationId: target.id,
    lastUnitCostAmount,
    avgUnitCostAmount,
    averageWindowDays,
    historyCount: metrics.averageSamplesCount,
  };
}
