import prismaClient from "~/lib/prisma/client.server";
import { itemCostVariationPrismaEntity, type ItemCostVariationSource } from "~/domain/item/item-cost-variation.prisma.entity.server";
import {
  getDefaultDirectionForMovementType,
  normalizeStockMovementDirection,
  normalizeStockMovementType,
  type StockMovementDirection,
  type StockMovementType,
} from "~/domain/stock-movement/stock-movement-types";

const COST_REFERENCE_TYPE_MOVEMENT = "stock-movement";

export type RegisterItemCostEventInput = {
  client?: any;
  itemVariationId: string;
  costAmount: number;
  unit?: string | null;
  source?: ItemCostVariationSource | null;
  movementType?: StockMovementType | null;
  direction?: StockMovementDirection | null;
  quantityAmount?: number | null;
  quantityUnit?: string | null;
  movementUnit?: string | null;
  conversionSource?: string | null;
  conversionFactorUsed?: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  invoiceNumber?: string | null;
  movementAt?: Date | null;
  appliedBy?: string | null;
  validFrom?: Date | null;
  importBatchId?: string | null;
  importLineId?: string | null;
  originType?: string | null;
  originRefId?: string | null;
  metadata?: Record<string, unknown> | null;
  comparisonOnly?: boolean;
};

export async function registerItemCostEvent(input: RegisterItemCostEventInput) {
  if (!input.itemVariationId) throw new Error("itemVariationId é obrigatório");

  const nextCost = Number(input.costAmount);
  if (!Number.isFinite(nextCost) || nextCost <= 0) {
    throw new Error("costAmount inválido");
  }

  const db = (input.client || prismaClient) as any;
  const movementType = normalizeStockMovementType(input.movementType || input.source || "manual");
  const direction = normalizeStockMovementDirection(
    input.direction || getDefaultDirectionForMovementType(movementType)
  );
  const effectiveAt = input.validFrom || input.movementAt || new Date();
  const comparisonOnly = input.comparisonOnly === true;

  return await db.$transaction(async (tx: any) => {
    const itemVariation = await tx.itemVariation.findUnique({
      where: { id: input.itemVariationId },
      select: {
        id: true,
        itemId: true,
        deletedAt: true,
      },
    });

    if (!itemVariation || itemVariation.deletedAt) {
      throw new Error("ItemVariation inválida ou removida");
    }

    const currentCost = await tx.itemCostVariation.findUnique({
      where: { itemVariationId: input.itemVariationId },
      select: {
        id: true,
        costAmount: true,
        unit: true,
      },
    });

    const metadata = {
      ...(input.metadata || {}),
      comparisonOnly,
      sourceOfTruth: "stock-movement",
      movementType,
      direction,
      originType: input.originType || null,
      originRefId: input.originRefId || null,
    };

    const movement = await tx.stockMovement.create({
      data: {
        direction,
        movementType,
        originType: input.originType || null,
        originRefId: input.originRefId || null,
        importBatchId: input.importBatchId || null,
        importLineId: input.importLineId || null,
        itemId: itemVariation.itemId,
        itemVariationId: input.itemVariationId,
        supplierId: input.supplierId || null,
        quantityAmount: input.quantityAmount ?? null,
        quantityUnit: input.quantityUnit || null,
        previousCostVariationId: currentCost?.id || null,
        lastCostAtImport: currentCost ? Number(currentCost.costAmount || 0) : null,
        lastCostUnitAtImport: currentCost?.unit || null,
        newCostAtImport: nextCost,
        newCostUnitAtImport: input.unit || null,
        movementUnit: input.movementUnit || input.unit || null,
        conversionSource: input.conversionSource || null,
        conversionFactorUsed: input.conversionFactorUsed ?? null,
        invoiceNumber: input.invoiceNumber || null,
        supplierName: input.supplierName || null,
        supplierCnpj: input.supplierCnpj || null,
        movementAt: input.movementAt || effectiveAt,
        appliedBy: input.appliedBy || null,
        metadata,
      },
    });

    const costInput = {
      itemVariationId: input.itemVariationId,
      costAmount: nextCost,
      unit: input.unit || null,
      source: movementType,
      referenceType: COST_REFERENCE_TYPE_MOVEMENT,
      referenceId: movement.id,
      validFrom: effectiveAt,
      updatedBy: input.appliedBy || null,
      metadata: {
        ...metadata,
        stockMovementId: movement.id,
      },
    };

    if (comparisonOnly) {
      await itemCostVariationPrismaEntity.addHistoryEntryWithClient(tx, costInput);
    } else {
      await itemCostVariationPrismaEntity.setCurrentCostWithClient(tx, costInput);
    }

    return movement;
  });
}
