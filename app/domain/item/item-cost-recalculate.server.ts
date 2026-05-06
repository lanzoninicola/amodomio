import prismaClient from "~/lib/prisma/client.server";
import {
  isItemCostExcludedFromMetrics,
  normalizeItemCostToConsumptionUnit,
} from "~/domain/item/item-cost-metrics.server";

// ─── scan ────────────────────────────────────────────────────────────────────

export type ScanItemResult = {
  itemId: string;
  name: string;
  consumptionUm: string | null;
  movementLinkedEntries: number; // history entries with referenceType='stock-movement'
  recalculableEntries: number;   // subset where normalization would produce a different value
};

export type ScanResult = {
  items: ScanItemResult[];
  totalItems: number;
  itemsWithChanges: number;
  totalRecalculable: number;
};

export async function scanItemsForRecalculation(): Promise<ScanResult> {
  const db = prismaClient as any;

  // Load all active insumos with their primary variation and recent movement-linked history
  const allItems = await db.item.findMany({
    where: { active: true, classification: "insumo" },
    select: {
      id: true,
      name: true,
      consumptionUm: true,
      purchaseUm: true,
      purchaseToConsumptionFactor: true,
      ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      ItemVariation: {
        where: { deletedAt: null },
        select: {
          id: true,
          isReference: true,
          createdAt: true,
          ItemCostVariationHistory: {
            where: { referenceType: "stock-movement" },
            select: { id: true, costAmount: true, unit: true, referenceId: true, metadata: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  // Collect all movement IDs referenced by history entries
  const allMovementIds = new Set<string>();
  for (const item of allItems) {
    const active = (item.ItemVariation || []);
    const primary = active.find((v: any) => v.isReference) || active[0];
    if (!primary) continue;
    for (const entry of primary.ItemCostVariationHistory || []) {
      if (entry.referenceId) allMovementIds.add(entry.referenceId);
    }
  }

  // Fetch all movements in one query
  const movements = allMovementIds.size > 0
    ? await db.stockMovement.findMany({
        where: { id: { in: Array.from(allMovementIds) } },
        select: { id: true, newCostAtImport: true, newCostUnitAtImport: true, movementType: true },
      })
    : [];
  const movementMap = new Map<string, { newCostAtImport: any; newCostUnitAtImport: any; movementType: any }>(
    movements.map((m: any) => [m.id, m])
  );

  const items: ScanItemResult[] = [];

  for (const item of allItems) {
    const active = (item.ItemVariation || []);
    const primary = active.find((v: any) => v.isReference) || active[0];
    if (!primary) continue;

    const entries: any[] = primary.ItemCostVariationHistory || [];
    if (entries.length === 0) continue;

    let recalculable = 0;

    for (const entry of entries) {
      if (isItemCostExcludedFromMetrics(entry)) continue;
      if (!entry.referenceId) continue;

      const movement = movementMap.get(entry.referenceId);
      if (!movement) continue;
      if (String(movement.movementType || "").trim().toLowerCase() !== "import") continue;

      const normalizedFromMovement = normalizeItemCostToConsumptionUnit(
        { costAmount: movement.newCostAtImport, unit: movement.newCostUnitAtImport },
        item
      );
      if (normalizedFromMovement === null) continue;

      const normalizedFromEntry = normalizeItemCostToConsumptionUnit(entry, item);
      if (normalizedFromEntry !== null && Math.abs(normalizedFromEntry - normalizedFromMovement) < 0.001) continue;

      recalculable++;
    }

    items.push({
      itemId: item.id,
      name: item.name,
      consumptionUm: item.consumptionUm ?? null,
      movementLinkedEntries: entries.length,
      recalculableEntries: recalculable,
    });
  }

  // Sort: items with changes first, then alphabetically
  items.sort((a, b) => {
    if (b.recalculableEntries !== a.recalculableEntries) return b.recalculableEntries - a.recalculableEntries;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return {
    items,
    totalItems: items.length,
    itemsWithChanges: items.filter(i => i.recalculableEntries > 0).length,
    totalRecalculable: items.reduce((s, i) => s + i.recalculableEntries, 0),
  };
}

// ─── filtered scan ───────────────────────────────────────────────────────────

export type ScanFilters = {
  itemId?: string;          // filter by exact item id
  search?: string;          // filter by item name (case-insensitive contains)
  consumptionUm?: string;   // filter by exact consumptionUm value
  onlyWithIssues?: boolean; // if true, only return items where recalculableEntries > 0
};

export async function scanItemsForRecalculationFiltered(
  filters: ScanFilters
): Promise<ScanResult> {
  const db = prismaClient as any;

  const itemWhere: Record<string, any> = { active: true, classification: "insumo" };
  if (filters.itemId) {
    itemWhere.id = filters.itemId;
  } else if (filters.search) {
    itemWhere.name = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.consumptionUm) {
    itemWhere.consumptionUm = filters.consumptionUm;
  }

  const allItems = await db.item.findMany({
    where: itemWhere,
    select: {
      id: true,
      name: true,
      consumptionUm: true,
      purchaseUm: true,
      purchaseToConsumptionFactor: true,
      ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      ItemVariation: {
        where: { deletedAt: null },
        select: {
          id: true,
          isReference: true,
          createdAt: true,
          ItemCostVariationHistory: {
            where: { referenceType: "stock-movement" },
            select: { id: true, costAmount: true, unit: true, referenceId: true, metadata: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  // Collect all movement IDs referenced by history entries
  const allMovementIds = new Set<string>();
  for (const item of allItems) {
    const active = (item.ItemVariation || []);
    const primary = active.find((v: any) => v.isReference) || active[0];
    if (!primary) continue;
    for (const entry of primary.ItemCostVariationHistory || []) {
      if (entry.referenceId) allMovementIds.add(entry.referenceId);
    }
  }

  // Fetch all movements in one query
  const movements = allMovementIds.size > 0
    ? await db.stockMovement.findMany({
        where: { id: { in: Array.from(allMovementIds) } },
        select: { id: true, newCostAtImport: true, newCostUnitAtImport: true, movementType: true },
      })
    : [];
  const movementMap = new Map<string, { newCostAtImport: any; newCostUnitAtImport: any; movementType: any }>(
    movements.map((m: any) => [m.id, m])
  );

  let items: ScanItemResult[] = [];

  for (const item of allItems) {
    const active = (item.ItemVariation || []);
    const primary = active.find((v: any) => v.isReference) || active[0];
    if (!primary) continue;

    const entries: any[] = primary.ItemCostVariationHistory || [];
    if (entries.length === 0) continue;

    let recalculable = 0;

    for (const entry of entries) {
      if (isItemCostExcludedFromMetrics(entry)) continue;
      if (!entry.referenceId) continue;

      const movement = movementMap.get(entry.referenceId);
      if (!movement) continue;
      if (String(movement.movementType || "").trim().toLowerCase() !== "import") continue;

      const normalizedFromMovement = normalizeItemCostToConsumptionUnit(
        { costAmount: movement.newCostAtImport, unit: movement.newCostUnitAtImport },
        item
      );
      if (normalizedFromMovement === null) continue;

      const normalizedFromEntry = normalizeItemCostToConsumptionUnit(entry, item);
      if (normalizedFromEntry !== null && Math.abs(normalizedFromEntry - normalizedFromMovement) < 0.001) continue;

      recalculable++;
    }

    items.push({
      itemId: item.id,
      name: item.name,
      consumptionUm: item.consumptionUm ?? null,
      movementLinkedEntries: entries.length,
      recalculableEntries: recalculable,
    });
  }

  // Apply onlyWithIssues filter after computing results
  if (filters.onlyWithIssues) {
    items = items.filter((i) => i.recalculableEntries > 0);
  }

  // Sort: items with changes first, then alphabetically
  items.sort((a, b) => {
    if (b.recalculableEntries !== a.recalculableEntries) return b.recalculableEntries - a.recalculableEntries;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return {
    items,
    totalItems: items.length,
    itemsWithChanges: items.filter((i) => i.recalculableEntries > 0).length,
    totalRecalculable: items.reduce((s, i) => s + i.recalculableEntries, 0),
  };
}

// ─── bulk recalculate ────────────────────────────────────────────────────────

export type BulkRecalculateItemResult = {
  itemId: string;
  name: string;
  updated: number;
  skipped: number;
  errors: number;
  log: string[];
};

export type BulkRecalculateResult = {
  results: BulkRecalculateItemResult[];
  totals: { updated: number; skipped: number; errors: number };
};

export async function recalculateAllItemsCostHistory(
  itemIds: string[]
): Promise<BulkRecalculateResult> {
  const results: BulkRecalculateItemResult[] = [];
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const itemId of itemIds) {
    const r = await recalculateItemCostHistory(itemId);
    const db = prismaClient as any;
    const item = await db.item.findUnique({ where: { id: itemId }, select: { name: true } });
    results.push({ itemId, name: item?.name ?? itemId, ...r });
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalErrors += r.errors;
  }

  return {
    results,
    totals: { updated: totalUpdated, skipped: totalSkipped, errors: totalErrors },
  };
}

export async function recalculateItemCostHistory(itemId: string): Promise<{
  updated: number;
  skipped: number;
  errors: number;
  log: string[];
}> {
  const db = prismaClient as any;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const log: string[] = [];

  // 1. Load the item with measurement config and purchase conversions
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      consumptionUm: true,
      purchaseUm: true,
      purchaseToConsumptionFactor: true,
      ItemPurchaseConversion: {
        select: { purchaseUm: true, factor: true },
      },
      ItemVariation: {
        where: { deletedAt: null },
        select: {
          id: true,
          isReference: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!item) {
    log.push(`Item ${itemId} not found`);
    return { updated, skipped, errors: 1, log };
  }

  // 2. Find the primary variation (isReference=true, or first active one)
  const activeVariations = (item.ItemVariation || []).filter((v: any) => !v.deletedAt);
  const primaryVariation =
    activeVariations.find((v: any) => v.isReference) || activeVariations[0] || null;

  if (!primaryVariation) {
    log.push(`No active variation found for item ${item.name}`);
    return { updated, skipped, errors: 0, log };
  }

  // 3. Load all history entries for the primary variation
  const historyEntries = await db.itemCostVariationHistory.findMany({
    where: { itemVariationId: primaryVariation.id },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
  });

  // 4. Process each entry
  for (const entry of historyEntries) {
    try {
      // a. Skip excluded entries
      if (isItemCostExcludedFromMetrics(entry)) {
        skipped++;
        continue;
      }

      // b. Skip if not a stock-movement reference
      if (entry.referenceType !== "stock-movement" || !entry.referenceId) {
        skipped++;
        continue;
      }

      // c. Load the stock movement
      const movement = await db.stockMovement.findUnique({
        where: { id: entry.referenceId },
        select: {
          id: true,
          newCostAtImport: true,
          newCostUnitAtImport: true,
        },
      });

      // d. Skip if movement not found
      if (!movement) {
        skipped++;
        log.push(`Movement ${entry.referenceId} not found for entry ${entry.id}, skipping`);
        continue;
      }

      // e. Try to normalize the movement's cost using current item config
      const movementCost = {
        costAmount: movement.newCostAtImport,
        unit: movement.newCostUnitAtImport,
      };
      const normalizedFromMovement = normalizeItemCostToConsumptionUnit(movementCost, item);

      // f. Skip if normalization returns null (still can't convert)
      if (normalizedFromMovement === null) {
        skipped++;
        continue;
      }

      // g. Try to normalize the CURRENT history entry
      const normalizedFromEntry = normalizeItemCostToConsumptionUnit(entry, item);

      // If already correct (within 0.001 tolerance), skip
      if (
        normalizedFromEntry !== null &&
        Math.abs(normalizedFromEntry - normalizedFromMovement) < 0.001
      ) {
        skipped++;
        continue;
      }

      // h. Update the history entry
      const oldAmount = Number(entry.costAmount ?? 0);
      const oldUnit = String(entry.unit || "");
      const newAmount = normalizedFromMovement;
      const newUnit = String(item.consumptionUm || "");

      await db.itemCostVariationHistory.update({
        where: { id: entry.id },
        data: {
          costAmount: newAmount,
          unit: newUnit,
        },
      });

      updated++;
      const dateLabel =
        entry.validFrom
          ? new Date(entry.validFrom).toLocaleString("pt-BR")
          : entry.createdAt
          ? new Date(entry.createdAt).toLocaleString("pt-BR")
          : entry.id;
      log.push(
        `Updated ${item.name} entry ${dateLabel}: ${oldAmount.toFixed(4)}/${oldUnit} → ${newAmount.toFixed(4)}/${newUnit}`
      );
    } catch (err) {
      errors++;
      log.push(`Error processing entry ${entry.id}: ${String(err)}`);
    }
  }

  // 5. If any entries were updated, sync ItemCostVariation with the most recent non-excluded entry
  if (updated > 0) {
    try {
      const refreshedHistory = await db.itemCostVariationHistory.findMany({
        where: { itemVariationId: primaryVariation.id },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      });

      const mostRecent = refreshedHistory.find(
        (e: any) => !isItemCostExcludedFromMetrics(e)
      );

      if (mostRecent) {
        const normalizedLatest = normalizeItemCostToConsumptionUnit(mostRecent, item);
        if (normalizedLatest !== null) {
          const targetUnit = String(item.consumptionUm || mostRecent.unit || "");
          await db.itemCostVariation.updateMany({
            where: { itemVariationId: primaryVariation.id },
            data: {
              costAmount: normalizedLatest,
              unit: targetUnit,
            },
          });
          log.push(
            `Synced ItemCostVariation to ${normalizedLatest.toFixed(4)}/${targetUnit}`
          );
        }
      }
    } catch (err) {
      errors++;
      log.push(`Error syncing ItemCostVariation: ${String(err)}`);
    }
  }

  return { updated, skipped, errors, log };
}
