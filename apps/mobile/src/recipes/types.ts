export type RecipeSummary = {
  id: string;
  name: string;
  description: string | null;
  Item: { name: string } | null;
};
export type Ingredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  preferredUnit: string | null;
  notes: string | null;
  subRecipe: { id: string; name: string } | null;
  displayUnits: { unit: string; factor: number }[];
};
export type ThermalPhase = {
  upperTemperatureCelsius: number | null;
  lowerTemperatureCelsius: number | null;
  durationMinutes: number | null;
  notes: string | null;
} | null;
export type MobileRecipe = {
  id: string;
  name: string;
  description: string | null;
  costingMode: string;
  yieldQuantity: number | null;
  yieldUnit: string | null;
  ingredients: Ingredient[];
  productionProcedure: string | null;
  productionNotes: string | null;
  preheating: ThermalPhase;
  baking: ThermalPhase;
};
export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};
export type SavedTemplate = TemplateSummary & {
  snapshot: import("./template").RecipeTemplateSnapshot;
};
