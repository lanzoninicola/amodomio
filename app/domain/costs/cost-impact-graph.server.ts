export type CostImpactGraph = {
  sourceItemId: string;
  affectedRecipeIds: string[];
  affectedItemCostSheetIds: string[];
  affectedItemIds: string[];
  affectedMenuItemIds: string[];
};

export async function buildCostImpactGraphForItem(
  db: any,
  itemId: string
): Promise<CostImpactGraph> {
  const sourceItemId = String(itemId || "").trim();
  if (!sourceItemId) {
    return {
      sourceItemId: "",
      affectedRecipeIds: [],
      affectedItemCostSheetIds: [],
      affectedItemIds: [],
      affectedMenuItemIds: [],
    };
  }

  const affectedRecipeIds = new Set<string>();
  const affectedItemCostSheetIds = new Set<string>();
  const affectedItemIds = new Set<string>([sourceItemId]);
  const affectedMenuItemIds = new Set<string>();

  const directRecipes = await db.recipeIngredient.findMany({
    where: { ingredientItemId: sourceItemId },
    select: { recipeId: true },
  });
  for (const row of directRecipes) {
    const recipeId = String(row.recipeId || "").trim();
    if (recipeId) affectedRecipeIds.add(recipeId);
  }

  if (affectedRecipeIds.size > 0) {
    const recipes = await db.recipe.findMany({
      where: { id: { in: Array.from(affectedRecipeIds) } },
      select: { id: true, itemId: true },
    });
    for (const recipe of recipes) {
      const recipeItemId = String(recipe.itemId || "").trim();
      if (recipeItemId) affectedItemIds.add(recipeItemId);
    }
  }

  const baseSheetsByItem = await db.itemCostSheet.findMany({
    where: {
      itemId: { in: Array.from(affectedItemIds) },
      baseItemCostSheetId: null,
    },
    select: { id: true },
  });
  const sheetQueue = baseSheetsByItem
    .map((row: any) => String(row.id || "").trim())
    .filter(Boolean);

  while (sheetQueue.length > 0) {
    const rootSheetId = sheetQueue.shift() as string;
    if (!rootSheetId || affectedItemCostSheetIds.has(rootSheetId)) continue;
    affectedItemCostSheetIds.add(rootSheetId);

    const dependents = await db.itemCostSheetComponent.findMany({
      where: { type: "recipeSheet", refId: rootSheetId },
      select: { itemCostSheetId: true },
    });

    for (const dep of dependents) {
      const dependentSheetId = String(dep.itemCostSheetId || "").trim();
      if (!dependentSheetId) continue;

      const dependentSheet = await db.itemCostSheet.findUnique({
        where: { id: dependentSheetId },
        select: { id: true, baseItemCostSheetId: true, itemId: true },
      });
      const dependentRootSheetId = String(
        dependentSheet?.baseItemCostSheetId || dependentSheet?.id || ""
      ).trim();
      const dependentItemId = String(dependentSheet?.itemId || "").trim();

      if (dependentItemId) affectedItemIds.add(dependentItemId);
      if (
        dependentRootSheetId &&
        !affectedItemCostSheetIds.has(dependentRootSheetId)
      ) {
        sheetQueue.push(dependentRootSheetId);
      }
    }
  }

  const menuItems = await db.menuItem.findMany({
    where: { itemId: { in: Array.from(affectedItemIds) } },
    select: { id: true },
  });
  for (const menuItem of menuItems) {
    const menuItemId = String(menuItem.id || "").trim();
    if (menuItemId) affectedMenuItemIds.add(menuItemId);
  }

  return {
    sourceItemId,
    affectedRecipeIds: Array.from(affectedRecipeIds),
    affectedItemCostSheetIds: Array.from(affectedItemCostSheetIds),
    affectedItemIds: Array.from(affectedItemIds),
    affectedMenuItemIds: Array.from(affectedMenuItemIds),
  };
}
