import { expect, it } from "vitest";
import { buildRecipeTemplateView } from "./recipe-template-view";
import type { getMobileRecipe } from "./mobile-recipe.server";
const recipe = {
  id: "recipe-1",
  name: "Receita alterada",
  description: null,
  costingMode: "yield",
  yieldQuantity: 99,
  yieldUnit: "KG",
  productionProcedure: "Misture",
  productionNotes: null,
  preheating: null,
  baking: null,
  ingredients: [
    {
      id: "flour",
      name: "Nome atual",
      quantity: 999,
      unit: "KG",
      preferredUnit: "KG",
      notes: null,
      subRecipe: null,
      displayUnits: [
        { unit: "KG", factor: 1 },
        { unit: "G", factor: 1000 },
      ],
    },
  ],
} as Awaited<ReturnType<typeof getMobileRecipe>>;
const template = {
  name: "Produção salva",
  description: "Turno da manhã",
  snapshot: {
    version: 1 as const,
    recipeName: "Receita original",
    scaleFactor: 2,
    yieldQuantity: 20,
    yieldUnit: "KG",
    ingredients: [
      {
        id: "flour",
        name: "Farinha salva",
        quantity: 10000,
        unit: "G",
        notes: "Observação salva",
      },
    ],
  },
};
it("preserves saved names, quantities and yield despite changes to the source", () => {
  const before = JSON.stringify(template);
  const view = buildRecipeTemplateView(recipe, template);
  expect(view.name).toBe(template.name);
  expect(view.yieldQuantity).toBe(20);
  expect(view.ingredients[0]).toMatchObject({
    name: "Farinha salva",
    quantity: 10000,
    unit: "G",
    notes: "Observação salva",
  });
  expect(view.ingredients[0].displayUnits).toEqual([
    { unit: "G", factor: 1 },
    { unit: "KG", factor: 0.001 },
  ]);
  expect(view.ingredients[0].preferredUnit).toBe("KG");
  expect(JSON.stringify(template)).toBe(before);
});
it("keeps saved ingredients even after removal from the current recipe", () => {
  const view = buildRecipeTemplateView(
    { ...recipe, ingredients: [] },
    template
  );
  expect(view.ingredients[0]).toMatchObject({
    name: "Farinha salva",
    quantity: 10000,
    displayUnits: [{ unit: "G", factor: 1 }],
    preferredUnit: null,
  });
});
it("keeps valid unit conversion factors for a saved zero quantity", () => {
  const view = buildRecipeTemplateView(recipe, {
    ...template,
    snapshot: {
      ...template.snapshot,
      ingredients: [{ ...template.snapshot.ingredients[0], quantity: 0 }],
    },
  });
  expect(view.ingredients[0].quantity).toBe(0);
  expect(view.ingredients[0].displayUnits).toContainEqual({
    unit: "KG",
    factor: 0.001,
  });
});
