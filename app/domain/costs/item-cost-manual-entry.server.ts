import prismaClient from "~/lib/prisma/client.server";

const MANUAL_ENTRY_ORIGIN_TYPES = new Set([
  "item-cost-manual-entry",
  "item-cost-manual-entry-mobile",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function str(value: unknown) {
  return String(value || "").trim();
}

function normalizeUnit(value: string | null | undefined) {
  const normalized = str(value).toUpperCase();
  return normalized || null;
}

function isComparisonOnly(metadata: unknown) {
  const record = asRecord(metadata);
  return record.comparisonOnly === true || record.excludeFromMetrics === true;
}

function isHistoryHidden(metadata: unknown) {
  const record = asRecord(metadata);
  return record.hideFromItemHistory === true || record.hideFromGlobalCostHistory === true;
}

async function loadManualEntry(tx: any, itemId: string, historyId: string) {
  const history = await tx.itemCostVariationHistory.findUnique({
    where: { id: historyId },
    select: {
      id: true,
      itemVariationId: true,
      costAmount: true,
      previousCostAmount: true,
      unit: true,
      source: true,
      referenceType: true,
      referenceId: true,
      validFrom: true,
      metadata: true,
      ItemVariation: {
        select: {
          id: true,
          itemId: true,
        },
      },
    },
  });

  if (!history) throw new Error("Levantamento manual não encontrado");
  if (String(history.ItemVariation?.itemId || "") !== String(itemId)) {
    throw new Error("Levantamento manual não pertence a este item");
  }
  const comparisonOnly = isComparisonOnly(history.metadata);

  if (str(history.referenceType) !== "stock-movement" || !str(history.referenceId)) {
    const source = str(history.source).toLowerCase();
    if (source === "manual" && comparisonOnly) {
      return {
        history,
        movement: null,
        comparisonOnly: true,
        legacyHistoryOnly: true,
      };
    }
    throw new Error("Esse registro não está vinculado a uma movimentação manual editável");
  }

  const movement = await tx.stockMovement.findUnique({
    where: { id: str(history.referenceId) },
    select: {
      id: true,
      itemId: true,
      itemVariationId: true,
      movementType: true,
      originType: true,
      originRefId: true,
      lastCostAtImport: true,
      lastCostUnitAtImport: true,
      newCostAtImport: true,
      newCostUnitAtImport: true,
      movementUnit: true,
      supplierName: true,
      movementAt: true,
      deletedAt: true,
      metadata: true,
    },
  });

  if (!movement) throw new Error("Movimentação manual não encontrada");
  if (String(movement.itemId || "") !== String(itemId)) {
    throw new Error("Movimentação manual não pertence a este item");
  }
  if (String(movement.itemVariationId || "") !== String(history.itemVariationId || "")) {
    throw new Error("Movimentação manual inconsistente");
  }
  if (!MANUAL_ENTRY_ORIGIN_TYPES.has(str(movement.originType))) {
    throw new Error("Somente levantamentos manuais podem ser alterados ou eliminados aqui");
  }
  if (movement.deletedAt) {
    throw new Error("Esse levantamento manual já foi eliminado");
  }

  return {
    history,
    movement,
    comparisonOnly,
    legacyHistoryOnly: false,
  };
}

async function resolveReplacementCurrentCost(tx: any, itemVariationId: string, excludedHistoryId: string) {
  const candidates = await tx.itemCostVariationHistory.findMany({
    where: {
      itemVariationId,
      id: { not: excludedHistoryId },
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      costAmount: true,
      previousCostAmount: true,
      unit: true,
      source: true,
      referenceType: true,
      referenceId: true,
      validFrom: true,
      metadata: true,
    },
  });

  const movementIds = Array.from(
    new Set(
      candidates
        .filter((row: any) => str(row.referenceType) === "stock-movement" && str(row.referenceId))
        .map((row: any) => str(row.referenceId)),
    ),
  );
  const movements = movementIds.length > 0
    ? await tx.stockMovement.findMany({
        where: { id: { in: movementIds } },
        select: { id: true, deletedAt: true },
      })
    : [];
  const movementLookup = new Map<string, { deletedAt: Date | null }>(
    movements.map((movement: any) => [String(movement.id), { deletedAt: movement.deletedAt || null }]),
  );

  for (const row of candidates as any[]) {
    if (str(row.referenceType) === "stock-movement-delete") continue;
    if (isComparisonOnly(row.metadata)) continue;
    if (isHistoryHidden(row.metadata)) continue;
    const referenceType = str(row.referenceType);
    const referenceId = str(row.referenceId);
    if (referenceType === "stock-movement" && referenceId) {
      const movement = movementLookup.get(referenceId);
      if (!movement || movement.deletedAt) continue;
    }
    return row;
  }

  return null;
}

export async function updateManualItemCostEntry(params: {
  itemId: string;
  historyId: string;
  costAmount: number;
  unit?: string | null;
  source?: string | null;
  supplierName?: string | null;
  notes?: string | null;
  validFrom: Date;
}) {
  const nextCostAmount = Number(params.costAmount);
  if (!Number.isFinite(nextCostAmount) || nextCostAmount <= 0) {
    throw new Error("Informe um custo maior que zero");
  }

  const unit = normalizeUnit(params.unit);
  const source = str(params.source || "manual") || "manual";
  const supplierName = str(params.supplierName || "") || null;
  const notes = str(params.notes || "") || null;

  return await (prismaClient as any).$transaction(async (tx: any) => {
    const { history, movement, comparisonOnly, legacyHistoryOnly } = await loadManualEntry(tx, params.itemId, params.historyId);
    const now = new Date();
    const historyMetadata = asRecord(history.metadata);
    const nextMetadata = {
      ...historyMetadata,
      supplierName,
      notes,
      comparisonOnly,
      excludeFromMetrics: comparisonOnly,
      editedAt: now.toISOString(),
      editedFrom: "admin-item-cost-history",
    };

    if (movement) {
      const movementMetadata = asRecord(movement.metadata);
      await tx.stockMovement.update({
        where: { id: movement.id },
        data: {
          movementType: source,
          newCostAtImport: nextCostAmount,
          newCostUnitAtImport: unit,
          movementUnit: unit,
          supplierName,
          movementAt: params.validFrom,
          metadata: {
            ...movementMetadata,
            ...nextMetadata,
            previousMovementType: movement.movementType || null,
          },
        },
      });
    }

    await tx.itemCostVariationHistory.update({
      where: { id: history.id },
      data: {
        costAmount: nextCostAmount,
        unit,
        source,
        validFrom: params.validFrom,
        metadata: nextMetadata,
      },
    });

    await tx.itemCostVariationHistoryAudit.create({
      data: {
        historyRecordId: history.id,
        itemVariationId: history.itemVariationId,
        costAmountBefore: Number(history.costAmount || 0),
        costAmountAfter: nextCostAmount,
        unitBefore: history.unit ?? null,
        unitAfter: unit,
        sourceBefore: history.source ?? null,
        sourceAfter: source,
        validFromBefore: history.validFrom,
        validFromAfter: params.validFrom,
        changedBy: null,
        changeReason: "manual_edit",
        metadata: {
          action: "manual_cost_entry_edit",
          stockMovementId: movement?.id || null,
          supplierName,
          notes,
          comparisonOnly,
          legacyHistoryOnly,
        },
        createdAt: now,
      },
    });

    if (legacyHistoryOnly) {
      return {
        comparisonOnly,
        updatedCurrentCost: false,
      };
    }

    const current = await tx.itemCostVariation.findUnique({
      where: { itemVariationId: history.itemVariationId },
      select: {
        id: true,
        previousCostAmount: true,
        referenceType: true,
        referenceId: true,
      },
    });
    const currentMatches =
      str(current?.referenceType) === "stock-movement" &&
      str(current?.referenceId) === movement?.id;

    if (currentMatches) {
      await tx.itemCostVariation.update({
        where: { itemVariationId: history.itemVariationId },
        data: {
          costAmount: nextCostAmount,
          previousCostAmount: Number(movement?.lastCostAtImport ?? current?.previousCostAmount ?? 0),
          unit,
          source,
          referenceType: "stock-movement",
          referenceId: movement?.id || null,
          validFrom: params.validFrom,
          updatedBy: null,
          deletedAt: null,
        },
      });
    }

    return {
      comparisonOnly,
      updatedCurrentCost: currentMatches,
    };
  });
}

export async function deleteManualItemCostEntry(params: {
  itemId: string;
  historyId: string;
}) {
  return await (prismaClient as any).$transaction(async (tx: any) => {
    const { history, movement, comparisonOnly, legacyHistoryOnly } = await loadManualEntry(tx, params.itemId, params.historyId);
    const now = new Date();
    const historyMetadata = asRecord(history.metadata);

    await tx.itemCostVariationHistory.update({
      where: { id: history.id },
      data: {
        metadata: {
          ...historyMetadata,
          excludeFromMetrics: true,
          hideFromItemHistory: true,
          hideFromGlobalCostHistory: true,
          deletedManualEntryAt: now.toISOString(),
          deletedManualStockMovementId: movement.id,
          deletedReason: "manual_entry_deleted",
        },
      },
    });

    await tx.itemCostVariationHistoryAudit.create({
      data: {
        historyRecordId: history.id,
        itemVariationId: history.itemVariationId,
        costAmountBefore: Number(history.costAmount || 0),
        costAmountAfter: Number(history.costAmount || 0),
        unitBefore: history.unit ?? null,
        unitAfter: history.unit ?? null,
        sourceBefore: history.source ?? null,
        sourceAfter: history.source ?? null,
        validFromBefore: history.validFrom,
        validFromAfter: history.validFrom,
        changedBy: null,
        changeReason: "manual_delete",
        metadata: {
          action: "manual_cost_entry_delete",
          stockMovementId: movement?.id || null,
          comparisonOnly,
          legacyHistoryOnly,
        },
        createdAt: now,
      },
    });

    if (movement) {
      const movementMetadata = asRecord(movement.metadata);
      const deletionHistory = Array.isArray(movementMetadata.deletionHistory)
        ? [...(movementMetadata.deletionHistory as any[])]
        : [];
      await tx.stockMovement.update({
        where: { id: movement.id },
        data: {
          deletedAt: now,
          metadata: {
            ...movementMetadata,
            deletedAt: now.toISOString(),
            deletedReason: "manual_entry_deleted",
            deletionHistory: [
              ...deletionHistory,
              {
                deletedAt: now.toISOString(),
                reason: "manual_entry_deleted",
                stockMovementId: movement.id,
              },
            ],
          },
        },
      });
    }

    if (legacyHistoryOnly) {
      return {
        comparisonOnly,
        restoredCurrentCost: false,
      };
    }

    const current = await tx.itemCostVariation.findUnique({
      where: { itemVariationId: history.itemVariationId },
      select: {
        id: true,
        referenceType: true,
        referenceId: true,
      },
    });
    const currentMatches =
      str(current?.referenceType) === "stock-movement" &&
      str(current?.referenceId) === movement?.id;

    if (currentMatches) {
      const replacement = await resolveReplacementCurrentCost(tx, history.itemVariationId, history.id);
      if (replacement) {
        await tx.itemCostVariation.update({
          where: { itemVariationId: history.itemVariationId },
          data: {
            costAmount: Number(replacement.costAmount || 0),
            previousCostAmount: Number(replacement.previousCostAmount || 0),
            unit: replacement.unit ?? null,
            source: replacement.source ?? null,
            referenceType: replacement.referenceType ?? null,
            referenceId: replacement.referenceId ?? null,
            validFrom: replacement.validFrom,
            updatedBy: null,
            deletedAt: null,
          },
        });
      } else {
        await tx.itemCostVariation.delete({
          where: { itemVariationId: history.itemVariationId },
        });
      }
    }

    return {
      comparisonOnly,
      restoredCurrentCost: currentMatches,
    };
  });
}
