import { listRecipeLinkedVariations } from "./recipe-composition.server";
import { notifyRecipeCostSheetRecalculationRequired } from "./recipe-cost-sheet-recalculation-notification.server";

export async function copyRecipeComposition(db: any, recipeId: string, sourceRecipeId: string, includeVariations: boolean) {
  if (!sourceRecipeId || recipeId === sourceRecipeId) throw new Error("Selecione outra receita.");
  return db.$transaction(async (tx: any) => {
    const target = await tx.recipe.findUnique({ where: { id: recipeId } });
    const source = await tx.recipe.findUnique({ where: { id: sourceRecipeId }, include: {
      RecipeIngredient: { orderBy: { sortOrderIndex: "asc" }, include: {
        IngredientItem: { select: { consumptionUm: true } },
        RecipeVariationIngredient: { include: { ItemVariation: true } },
      } },
    } });
    if (!target || !source) throw new Error("Receita não encontrada.");
    if (!source.RecipeIngredient.length) throw new Error("A receita de origem não tem composição.");
    if (includeVariations && !target.itemId) throw new Error("Vincule um item à receita antes de copiar variações.");
    const sourceVariations = await listRecipeLinkedVariations(tx, sourceRecipeId);
    let targetVariations = await listRecipeLinkedVariations(tx, recipeId);
    if (includeVariations) {
      for (const variation of sourceVariations) {
        if (!variation.variationId || targetVariations.some(v => v.variationId === variation.variationId)) continue;
        const existing = await tx.itemVariation.findUnique({ where: { itemId_variationId: { itemId: target.itemId, variationId: variation.variationId } } });
        // Never reactivate or take ownership of a variation belonging to another recipe.
        if (existing) throw new Error("Há uma variação arquivada no item de destino. Restaure-a antes de copiar.");
        await tx.itemVariation.create({ data: { itemId: target.itemId, variationId: variation.variationId, recipeId, isReference: targetVariations.length === 0 } });
        targetVariations = await listRecipeLinkedVariations(tx, recipeId);
      }
    }
    const existingIngredients = await tx.recipeIngredient.findMany({ where: { recipeId } });
    let nextOrder = Math.max(-1, ...existingIngredients.map((i: any) => i.sortOrderIndex)) + 1;
    for (const ingredient of source.RecipeIngredient) {
      const existing = existingIngredients.find((i: any) => i.ingredientItemId === ingredient.ingredientItemId);
      const copied = existing || await tx.recipeIngredient.create({ data: {
        recipeId, ingredientItemId: ingredient.ingredientItemId, defaultLossPct: ingredient.defaultLossPct,
        notes: ingredient.notes, sortOrderIndex: nextOrder++,
      } });
      for (const variation of targetVariations) {
        const sourceLine = includeVariations && ingredient.RecipeVariationIngredient.find((line: any) =>
          sourceVariations.some(v => v.itemVariationId === line.itemVariationId) && line.ItemVariation.variationId === variation.variationId);
        const data = sourceLine ? { quantity: sourceLine.quantity, unit: sourceLine.unit, lossPct: sourceLine.lossPct ?? ingredient.defaultLossPct }
          : { quantity: 0, unit: ingredient.IngredientItem.consumptionUm || "UN", lossPct: null };
        await tx.recipeVariationIngredient.upsert({
          where: { recipeIngredientId_itemVariationId: { recipeIngredientId: copied.id, itemVariationId: variation.itemVariationId } },
          create: { recipeIngredientId: copied.id, itemVariationId: variation.itemVariationId, ...data },
          update: sourceLine ? data : {},
        });
      }
    }
    await notifyRecipeCostSheetRecalculationRequired(tx, recipeId);
    return { ingredients: source.RecipeIngredient.length };
  }, { timeout: 30_000 });
}
