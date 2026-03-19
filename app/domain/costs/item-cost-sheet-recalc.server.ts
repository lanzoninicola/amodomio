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

export async function getRecipeCostSheetSnapshot(
  db: any,
  recipeId: string,
  itemVariationId?: string | null
) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) throw new Error("Receita não encontrada");

  const lines = (await listRecipeCompositionLines(db, recipeId)).filter(
    (line) =>
      !itemVariationId ||
      String(line.ItemVariation?.id || "") === String(itemVariationId)
  );
  const lastTotal = lines.reduce(
    (acc, line) => acc + Number(line.lastTotalCostAmount || 0),
    0
  );
  const avgTotal = lines.reduce(
    (acc, line) => acc + Number(line.avgTotalCostAmount || 0),
    0
  );

  return {
    recipe,
    lastTotal,
    avgTotal,
    unitCostAmount: avgTotal,
    note: `snapshot receita: ultimo=${lastTotal.toFixed(4)} medio=${avgTotal.toFixed(4)}`,
  };
}

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
          const snapshot = await getRecipeCostSheetSnapshot(
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

  return { rootSheetId, updatedSheets: groupSheets.length };
}
