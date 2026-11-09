import { calculateProductionPlan, convertQuantity } from "../../../../shared/production/order-plan";
import type { ProductionRecipe } from "./order-types";

export function previewRecipePreparations(recipe: ProductionRecipe, preparations: {
  name: string; ingredients: { recipeIngredientId: string; quantity: number; unit: string }[];
}[]) {
  const reference = recipe.ingredients.find((i) => i.id === recipe.baseIngredientId && i.quantity > 0)
    || recipe.ingredients.find((i) => i.quantity > 0);
  if (!reference) throw new Error("A receita precisa de ao menos um ingrediente com quantidade maior que zero.");
  return calculateProductionPlan({
    ingredients: recipe.ingredients, baseIngredientId: reference.id, baseQuantity: reference.quantity,
    preparations: preparations.map((p, index) => ({ id: String(index), name: p.name || `Preparação ${index + 1}`,
      ingredients: p.ingredients.map((line) => {
        const ingredient = recipe.ingredients.find((i) => i.id === line.recipeIngredientId);
        if (!ingredient) throw new Error("Ingrediente não encontrado na receita.");
        if (!Number.isFinite(line.quantity) || line.quantity < 0) throw new Error(`${ingredient.name}: quantidade inválida.`);
        const quantity = convertQuantity(line.quantity, line.unit, ingredient.unit);
        if (quantity == null) throw new Error(`${ingredient.name}: unidade incompatível.`);
        return { recipeIngredientId: ingredient.id, quantity };
      }),
    })),
  });
}
