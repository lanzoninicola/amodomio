import type { getMobileRecipe } from "./mobile-recipe.server";
import type { RecipeTemplateSnapshot } from "./recipe-template";
import {
  applyTemplateUnitPreference,
  getTemplateIngredientDisplayUnits,
} from "./recipe-template";

// Never replace saved quantities or names with values from the current recipe.
export function buildRecipeTemplateView(
  recipe: Awaited<ReturnType<typeof getMobileRecipe>>,
  template: {
    name: string;
    description: string | null;
    snapshot: RecipeTemplateSnapshot;
  }
) {
  return {
    ...recipe,
    name: template.name,
    description: template.description,
    costingMode: template.snapshot.yieldQuantity === null ? "unit" : "yield",
    yieldQuantity: template.snapshot.yieldQuantity,
    yieldUnit: template.snapshot.yieldUnit,
    ingredients: template.snapshot.ingredients.map((saved) => {
      const current = recipe.ingredients.find((entry) => entry.id === saved.id);
      const displayUnits = getTemplateIngredientDisplayUnits(
        saved,
        current
      ).map((unit) => ({
        unit,
        factor: applyTemplateUnitPreference(
          { ...saved, quantity: 1 },
          current,
          unit
        ).quantity,
      }));
      return {
        ...saved,
        displayUnits,
        preferredUnit:
          current?.preferredUnit &&
          displayUnits.some((entry) => entry.unit === current.preferredUnit)
            ? current.preferredUnit
            : null,
        subRecipe: current?.subRecipe || null,
      };
    }),
  };
}
