import type { PrismaClient } from "@prisma/client";
import { notifyRecipeCostSheetRecalculationRequired } from "./recipe-cost-sheet-recalculation-notification.server";

export async function replaceRecipeIngredient(
  db: PrismaClient,
  sourceItemId: string,
  targetItemId: string,
  selectedRecipeIds: string[]
) {
  const recipeIds = [...new Set(selectedRecipeIds)];
  if (!sourceItemId || !targetItemId || sourceItemId === targetItemId)
    throw new Error("Selecione dois insumos diferentes.");
  if (!recipeIds.length) throw new Error("Selecione ao menos uma receita.");

  return db.$transaction(
    async (tx) => {
      const target = await tx.item.findFirst({
        where: { id: targetItemId, archivedAt: null, active: true },
      });
      if (!target) throw new Error("O novo insumo não está disponível.");
      const recipes = await tx.recipe.findMany({
        where: { id: { in: recipeIds } },
        include: { RecipeIngredient: true },
      });
      if (recipes.length !== recipeIds.length)
        throw new Error("Uma receita não foi encontrada. Atualize a página.");
      for (const recipe of recipes) {
        if (recipe.status === "archived")
          throw new Error(`A receita ${recipe.name} está arquivada.`);
        if (recipe.itemId === targetItemId)
          throw new Error(
            `A receita ${recipe.name} não pode consumir seu próprio item.`
          );
        if (
          !recipe.RecipeIngredient.some(
            (line) => line.ingredientItemId === sourceItemId
          )
        )
          throw new Error(
            `A receita ${recipe.name} não contém mais o insumo original. Atualize a página.`
          );
        if (
          recipe.RecipeIngredient.some(
            (line) => line.ingredientItemId === targetItemId
          )
        )
          throw new Error(
            `A receita ${recipe.name} já contém o novo insumo. Desmarque-a para continuar.`
          );
      }
      // Keep the ingredient row ID: all variation quantities, units and losses remain untouched.
      const result = await tx.recipeIngredient.updateMany({
        where: { recipeId: { in: recipeIds }, ingredientItemId: sourceItemId },
        data: { ingredientItemId: targetItemId },
      });
      if (result.count !== recipeIds.length)
        throw new Error(
          "A composição mudou durante a operação. Atualize e tente novamente."
        );
      await tx.recipe.updateMany({
        where: { id: { in: recipeIds } },
        data: { updatedAt: new Date() },
      });
      for (const recipeId of recipeIds)
        await notifyRecipeCostSheetRecalculationRequired(tx, recipeId);
      return result.count;
    },
    { isolationLevel: "Serializable", timeout: 30_000 }
  );
}
