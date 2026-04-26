import { resolveItemCostSnapshot } from "~/domain/costs/item-cost-snapshot.server";
import { registerItemCostEvent } from "~/domain/costs/item-cost-event.server";
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server";

export function roundItemCostSheetMoney(value: number) {
  return Number(Number(value || 0).toFixed(6));
}

export function calcItemCostSheetTotalCostAmount(
  unitCostAmount: number,
  quantity: number,
  wastePerc: number
) {
  const baseAmount = Number(unitCostAmount || 0) * Number(quantity || 0);
  const wasteFactor = 1 + Number(wastePerc || 0) / 100;
  return roundItemCostSheetMoney(baseAmount * wasteFactor);
}

export async function getRecipeCompositionCostSnapshot(
  db: any,
  recipeId: string,
  itemVariationId?: string | null
) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) throw new Error("Receita não encontrada");

  const allLines = await listRecipeCompositionLines(db, recipeId);

  let lines = allLines;
  if (itemVariationId) {
    const ownerVariation = await db.itemVariation.findUnique({
      where: { id: itemVariationId },
      select: { variationId: true },
    });
    const variationId = ownerVariation?.variationId;
    lines = variationId
      ? allLines.filter(
          (line) =>
            String(line.ItemVariation?.variationId || "") === String(variationId)
        )
      : allLines;
  }

  let lastTotal = 0;
  let avgTotal = 0;

  for (const line of lines) {
    const variationId = line.ItemVariation?.variationId || null;
    const effectiveLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0);
    const costInfo = await resolveItemCostSnapshot({
      db,
      itemId: line.itemId,
      variationId,
    });
    const safeLossPct = Math.min(99.9999, Math.max(0, effectiveLossPct));
    const grossQuantity =
      safeLossPct > 0
        ? Number(
            (Number(line.quantity || 0) / (1 - safeLossPct / 100)).toFixed(6)
          )
        : Number(line.quantity || 0);

    lastTotal += Number(
      ((Number(costInfo.lastUnitCostAmount || 0) || 0) * grossQuantity).toFixed(6)
    );
    avgTotal += Number(
      ((Number(costInfo.avgUnitCostAmount || 0) || 0) * grossQuantity).toFixed(6)
    );
  }

  return {
    recipe,
    lastTotal,
    avgTotal,
    unitCostAmount: avgTotal,
    note: `calculado pela composicao da receita: ultimo=${lastTotal.toFixed(4)} medio=${avgTotal.toFixed(4)}`,
  };
}

export const getRecipeCostSheetSnapshot = getRecipeCompositionCostSnapshot;

export async function getItemCostSheetSnapshot(
  db: any,
  itemCostSheetId: string,
  itemVariationId?: string | null
) {
  const requestedSheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: {
      id: true,
      name: true,
      costAmount: true,
      itemVariationId: true,
      baseItemCostSheetId: true,
    },
  });
  if (!requestedSheet) throw new Error("Ficha de custo não encontrada");

  const rootSheetId = requestedSheet.baseItemCostSheetId || requestedSheet.id;
  let sheet = requestedSheet;

  if (itemVariationId) {
    const variationMatch = await db.itemCostSheet.findFirst({
      where: {
        itemVariationId,
        OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }],
      },
      select: {
        id: true,
        name: true,
        costAmount: true,
        itemVariationId: true,
        baseItemCostSheetId: true,
      },
    });
    if (variationMatch) sheet = variationMatch;
  }

  return {
    sheet,
    unitCostAmount: Number(sheet.costAmount || 0),
    note: `snapshot ficha: total=${Number(sheet.costAmount || 0).toFixed(4)}`,
  };
}

export async function recalcItemCostSheetTotals(db: any, itemCostSheetId: string) {
  const sheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: { id: true, itemVariationId: true, baseItemCostSheetId: true },
  });
  if (!sheet) return { rootSheetId: null, updatedSheets: 0 };

  const rootSheetId = sheet.baseItemCostSheetId || sheet.id;
  const groupSheets = await db.itemCostSheet.findMany({
    where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
    select: { id: true, itemVariationId: true },
    orderBy: [{ createdAt: "asc" }],
  });
  if (groupSheets.length === 0) {
    return { rootSheetId, updatedSheets: 0 };
  }

  const targetItemVariationIds = groupSheets
    .map((groupSheet: any) => String(groupSheet.itemVariationId || ""))
    .filter(Boolean);

  const components = await db.itemCostSheetComponent.findMany({
    where: { itemCostSheetId: rootSheetId },
    include: {
      ItemCostSheetVariationComponent: {
        where: {
          itemVariationId: {
            in: targetItemVariationIds,
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });
  for (const component of components) {
    const values = Array.isArray(component.ItemCostSheetVariationComponent)
      ? component.ItemCostSheetVariationComponent
      : [];
    if (!component.refId || values.length === 0) continue;

    for (const value of values) {
      try {
        if (component.type === "recipe") {
          const snapshot = await getRecipeCompositionCostSnapshot(
            db,
            component.refId,
            value.itemVariationId
          );
          await db.itemCostSheetVariationComponent.update({
            where: { id: value.id },
            data: {
              unitCostAmount: roundItemCostSheetMoney(snapshot.unitCostAmount),
              totalCostAmount: calcItemCostSheetTotalCostAmount(
                snapshot.unitCostAmount,
                Number(value.quantity || 0),
                Number(value.wastePerc || 0)
              ),
            },
          });
          await db.itemCostSheetComponent.update({
            where: { id: component.id },
            data: { notes: snapshot.note },
          });
          continue;
        }

        if (component.type === "recipeSheet") {
          if (component.refId === rootSheetId) continue;
          const snapshot = await getItemCostSheetSnapshot(
            db,
            component.refId,
            value.itemVariationId
          );
          await db.itemCostSheetVariationComponent.update({
            where: { id: value.id },
            data: {
              unitCostAmount: roundItemCostSheetMoney(snapshot.unitCostAmount),
              totalCostAmount: calcItemCostSheetTotalCostAmount(
                snapshot.unitCostAmount,
                Number(value.quantity || 0),
                Number(value.wastePerc || 0)
              ),
            },
          });
          await db.itemCostSheetComponent.update({
            where: { id: component.id },
            data: { notes: snapshot.note },
          });
        }
      } catch {
        // Keep previous values if the dependency is unavailable.
      }
    }
  }

  const refreshedComponents = await db.itemCostSheetComponent.findMany({
    where: { itemCostSheetId: rootSheetId },
    include: {
      ItemCostSheetVariationComponent: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  for (const groupSheet of groupSheets) {
    const totalAmount = refreshedComponents.reduce((acc: number, component: any) => {
      const value = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent.find(
            (row: any) => row.itemVariationId === groupSheet.itemVariationId
          ) || null
        : null;
      return acc + Number(value?.totalCostAmount || 0);
    }, 0);

    await db.itemCostSheet.update({
      where: { id: groupSheet.id },
      data: { costAmount: roundItemCostSheetMoney(totalAmount) },
    });
  }

  const publishedSnapshots = await publishActiveItemCostSheetSnapshots(db, rootSheetId);

  return { rootSheetId, updatedSheets: groupSheets.length, publishedSnapshots };
}

async function publishActiveItemCostSheetSnapshots(db: any, rootSheetId: string) {
  if (!rootSheetId) return 0;

  const activeSheets = await db.itemCostSheet.findMany({
    where: {
      isActive: true,
      OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }],
      ItemVariation: { deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      notes: true,
      costAmount: true,
      itemVariationId: true,
    },
  });

  const activeVariationIds = activeSheets
    .map((sheet: any) => String(sheet.itemVariationId || ""))
    .filter(Boolean);
  if (activeVariationIds.length === 0) return 0;

  const currentCosts = await db.itemCostVariation.findMany({
    where: {
      itemVariationId: { in: activeVariationIds },
    },
    select: {
      itemVariationId: true,
      costAmount: true,
      unit: true,
      source: true,
      referenceType: true,
      referenceId: true,
    },
  });

  const currentCostByVariationId = new Map<string, any>(
    currentCosts.map((row: any) => [String(row.itemVariationId || ""), row])
  );

  const currentReferenceIds = currentCosts
    .map((row: any) => String(row.referenceId || ""))
    .filter(Boolean);
  const movementRows = currentReferenceIds.length
    ? await db.stockMovement.findMany({
        where: { id: { in: currentReferenceIds } },
        select: {
          id: true,
          originType: true,
          originRefId: true,
        },
      })
    : [];
  const movementById = new Map<string, any>(
    movementRows.map((row: any) => [String(row.id || ""), row])
  );

  let published = 0;

  for (const sheet of activeSheets) {
    const itemVariationId = String(sheet.itemVariationId || "").trim();
    if (!itemVariationId) continue;

    const nextCost = Number(sheet.costAmount || 0);
    if (!(nextCost > 0)) continue;

    const current = currentCostByVariationId.get(itemVariationId);
    const currentMovement = current?.referenceId ? movementById.get(String(current.referenceId)) : null;
    const currentMatchesSameSheet =
      String(current?.source || "").trim().toLowerCase() === "item-cost-sheet" &&
      String(current?.referenceType || "").trim().toLowerCase() === "stock-movement" &&
      String(currentMovement?.originType || "").trim().toLowerCase() === "item-cost-sheet" &&
      String(currentMovement?.originRefId || "").trim() === String(sheet.id);

    if (currentMatchesSameSheet && Math.abs(Number(current?.costAmount || 0) - nextCost) < 0.000001) {
      continue;
    }

    await registerItemCostEvent({
      client: db,
      itemVariationId,
      costAmount: nextCost,
      unit: null,
      source: "item-cost-sheet",
      movementType: "item-cost-sheet",
      originType: "item-cost-sheet",
      originRefId: String(sheet.id),
      appliedBy: "system:item-cost-sheet",
      validFrom: new Date(),
      metadata: {
        itemCostSheetId: String(sheet.id),
        itemCostSheetName: String(sheet.name || "").trim() || null,
        notes: String(sheet.notes || "").trim() || null,
        sourceAction: "item_cost_sheet_recalc",
      },
    });
    published++;
  }

  return published;
}
