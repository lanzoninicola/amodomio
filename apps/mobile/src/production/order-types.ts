import type { ProductionPlan, ProductionRecipeIngredient, ProductionRecipePreparation } from "../../../../shared/production/order-plan";
export type { ProductionPlan };
export type ProductionRecipeSummary = {
  id: string; name: string; status: string; productionBaseRecipeIngredientId: string | null;
};
export type ProductionRecipe = {
  id: string; name: string; baseIngredientId: string | null;
  ingredients: ProductionRecipeIngredient[]; preparations: ProductionRecipePreparation[];
};
export type OrderStatus = "planned" | "in_progress" | "finished" | "cancelled";
export type ProductionStep = {
  id: string; name: string; kind: "preparation" | "final"; preparationId: string | null;
  status: "pending" | "in_progress" | "done"; sortOrder: number;
};
export type ProductionSummary = {
  id: string; number: number; recipeName: string; status: OrderStatus;
  baseIngredient: string; baseQuantity: number; baseUnit: string; productionDate: string; usageDate: string | null;
  Steps: { status: string }[];
};
export type ProductionOrder = Omit<ProductionSummary, "Steps"> & {
  plan: ProductionPlan; Steps: ProductionStep[]; notes: string | null;
  producedQuantity: number | null; producedUnit: string | null;
};
export type ProductionMutation =
  | { intent: "preview" | "create"; recipeId: string; baseIngredientId?: string; quantity: number; unit: string; date?: string; usageDate?: string | null; notes?: string }
  | { intent: "reorder"; id: string; stepIds: string[] }
  | { intent: "define-preparations"; id: string; saveToRecipe?: boolean;
      preparations: { name: string; notes?: string; ingredients: { recipeIngredientId: string; quantity: number; unit: string }[] }[] }
  | { intent: "start" | "cancel" | "finish" | "step"; id: string; stepId?: string; to?: string; producedQuantity?: string; producedUnit?: string }
  | { intent: "save-recipe"; recipeId: string; baseIngredientId: string;
      preparations: { name: string; notes?: string; ingredients: { recipeIngredientId: string; quantity: number; unit: string }[] }[] };
export type PreparationSuggestion = {
  name: string; notes: string; ingredients: { recipeIngredientId: string; quantity: number; unit: string }[];
};
export type ProductionResponse = {
  orders?: ProductionSummary[]; order?: ProductionOrder; suggestions?: PreparationSuggestion[];
  recipes?: ProductionRecipeSummary[]; recipe?: ProductionRecipe; plan?: ProductionPlan; baseQuantity?: number;
};
