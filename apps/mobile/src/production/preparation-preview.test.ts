import { describe, expect, it } from "vitest";
import { previewRecipePreparations } from "./preparation-preview";
import type { ProductionRecipe } from "./order-types";
const recipe: ProductionRecipe = {
  id: "r", name: "Massa", baseIngredientId: "f", preparations: [],
  ingredients: [{ id: "f", name: "Farinha", quantity: 10, unit: "KG" }, { id: "a", name: "Água", quantity: 6, unit: "L" }],
};
describe("preparation editing preview", () => {
  it("converts grams and millilitres while preserving the recipe totals", () => {
    const plan = previewRecipePreparations(recipe, [{ name: "Tangzhong", ingredients: [
      { recipeIngredientId: "f", quantity: 500, unit: "G" }, { recipeIngredientId: "a", quantity: 2000, unit: "ML" },
    ] }]);
    expect(plan.preparations[0].ingredients.map((i) => i.quantity)).toEqual([0.5, 2]);
    expect(plan.final.ingredients.map((i) => i.quantity)).toEqual([9.5, 4]);
    expect(plan.inconsistencies).toEqual([]);
  });
  it("subtracts allocations in different units across multiple preparations", () => {
    const plan = previewRecipePreparations(recipe, [
      { name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 2, unit: "KG" }] },
      { name: "Poolish", ingredients: [{ recipeIngredientId: "f", quantity: 500, unit: "G" }] },
    ]);
    expect(plan.final.ingredients.find((i) => i.id === "f")?.quantity).toBe(7.5);
  });
  it("flags over-allocation even when input units differ", () => {
    const plan = previewRecipePreparations(recipe, [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 11000, unit: "G" }] }]);
    expect(plan.inconsistencies).toHaveLength(1);
  });
  it("rejects incompatible units", () => {
    expect(() => previewRecipePreparations(recipe, [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 1, unit: "L" }] }])).toThrow("incompatível");
  });
  it.each([-1, NaN, Infinity])("rejects invalid quantities %s", (quantity) => {
    expect(() => previewRecipePreparations(recipe, [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity, unit: "KG" }] }])).toThrow("inválida");
  });
});
