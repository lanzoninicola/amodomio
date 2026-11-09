import { describe, expect, it } from "vitest";
import {
  applyTemplateUnitPreference,
  getTemplateIngredientDisplayUnits,
  createRecipeTemplateSnapshot,
} from "./recipe-template";

function source() {
  return {
    name: "Massa com margarina",
    costingMode: "yield",
    yieldQuantity: 10,
    yieldUnit: "KG",
    ingredients: [
      { id: "flour", name: "Farinha", quantity: 5, unit: "KG", notes: null },
      {
        id: "margarine",
        name: "Margarina",
        quantity: 500,
        unit: "G",
        notes: "Em temperatura ambiente",
      },
    ],
  };
}

describe("recipe template snapshots", () => {
  it("saves all adjusted quantities and yield, preserving units and notes", () => {
    const recipe = source();
    const snapshot = createRecipeTemplateSnapshot(recipe, 2);
    expect(snapshot.yieldQuantity).toBe(20);
    expect(
      snapshot.ingredients.map(({ quantity, unit }) => ({ quantity, unit }))
    ).toEqual([
      { quantity: 10, unit: "KG" },
      { quantity: 1000, unit: "G" },
    ]);
    expect(snapshot.ingredients[1].notes).toBe("Em temperatura ambiente");
    expect(recipe.ingredients[0].quantity).toBe(5);
  });

  it("preserves the saved composition when the original recipe changes", () => {
    const recipe = source();
    const snapshot = createRecipeTemplateSnapshot(recipe, 0.5);
    recipe.ingredients[0].name = "Outra farinha";
    recipe.ingredients[0].quantity = 100;
    recipe.ingredients.splice(1);
    expect(snapshot.ingredients).toHaveLength(2);
    expect(snapshot.ingredients[0]).toMatchObject({
      name: "Farinha",
      quantity: 2.5,
    });
  });

  it("saves each selected unit with its converted and scaled quantity", () => {
    const recipe = source();
    const withConversions = {
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ({
        ...ingredient,
        displayUnits:
          ingredient.unit === "KG"
            ? [{ unit: "G", factor: 1000 }]
            : [{ unit: "KG", factor: 0.001 }],
      })),
    };
    const snapshot = createRecipeTemplateSnapshot(withConversions, 2, {
      flour: "G",
      margarine: "KG",
    });
    expect(snapshot.ingredients[0]).toMatchObject({
      quantity: 10000,
      unit: "G",
    });
    expect(snapshot.ingredients[1]).toMatchObject({ quantity: 1, unit: "KG" });
    expect(recipe.ingredients[0]).toMatchObject({ quantity: 5, unit: "KG" });
  });

  it("rejects units without a server conversion", () => {
    expect(() =>
      createRecipeTemplateSnapshot(source(), 2, { flour: "ML" })
    ).toThrow("Unidade inválida");
  });

  it("uses the saved preference by default when creating new templates", () => {
    const recipe = source();
    const snapshot = createRecipeTemplateSnapshot(
      {
        ...recipe,
        ingredients: [
          {
            ...recipe.ingredients[0],
            preferredUnit: "G",
            displayUnits: [{ unit: "G", factor: 1000 }],
          },
        ],
      },
      2
    );
    expect(snapshot.ingredients[0]).toMatchObject({
      quantity: 10000,
      unit: "G",
    });
  });

  it("converts a saved template into the preferred unit without rewriting the snapshot", () => {
    const saved = { ...source().ingredients[0], unit: "G", quantity: 10000 };
    const current = {
      ...source().ingredients[0],
      preferredUnit: "KG",
      displayUnits: [{ unit: "G", factor: 1000 }],
    };
    expect(applyTemplateUnitPreference(saved, current)).toMatchObject({
      quantity: 10,
      unit: "KG",
    });
    expect(saved).toMatchObject({ quantity: 10000, unit: "G" });
  });

  it("keeps saved units when no preference or safe conversion exists", () => {
    const saved = source().ingredients[0];
    expect(applyTemplateUnitPreference(saved, undefined)).toBe(saved);
    expect(
      applyTemplateUnitPreference(saved, { ...saved, preferredUnit: null })
    ).toBe(saved);
    expect(
      applyTemplateUnitPreference(saved, { ...saved, preferredUnit: "ML" })
    ).toBe(saved);
  });

  it("lets an explicit viewing unit override the saved preference without changing quantities in storage", () => {
    const saved = { ...source().ingredients[0], quantity: 2500, unit: "G" };
    const current = {
      ...source().ingredients[0],
      preferredUnit: "G",
      displayUnits: [{ unit: "G", factor: 1000 }],
    };
    expect(applyTemplateUnitPreference(saved, current, "KG")).toMatchObject({
      quantity: 2.5,
      unit: "KG",
    });
    expect(applyTemplateUnitPreference(saved, current, "G")).toMatchObject({
      quantity: 2500,
      unit: "G",
    });
    expect(saved).toMatchObject({ quantity: 2500, unit: "G" });
  });

  it("offers only viewing units with safe conversions from the saved quantity", () => {
    const saved = { ...source().ingredients[0], quantity: 2500, unit: "G" };
    const current = {
      ...source().ingredients[0],
      displayUnits: [
        { unit: "G", factor: 1000 },
        { unit: "ML", factor: -1 },
        { unit: "L", factor: Infinity },
      ],
    };
    expect(getTemplateIngredientDisplayUnits(saved, current)).toEqual([
      "G",
      "KG",
    ]);
    expect(getTemplateIngredientDisplayUnits(saved, undefined)).toEqual(["G"]);
    expect(
      getTemplateIngredientDisplayUnits({ ...saved, unit: "UN" }, current)
    ).toEqual(["UN"]);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid scale %s", (scale) => {
    expect(() => createRecipeTemplateSnapshot(source(), scale)).toThrow();
  });

  it("supports recipes without yield and does not invent a yield", () => {
    const recipe = {
      ...source(),
      costingMode: "per_variation",
      yieldQuantity: null,
    };
    const snapshot = createRecipeTemplateSnapshot(recipe, 3);
    expect(snapshot.yieldQuantity).toBeNull();
    expect(snapshot.ingredients[0].quantity).toBe(15);
  });

  it("rejects empty compositions and overflowing quantities", () => {
    expect(() =>
      createRecipeTemplateSnapshot({ ...source(), ingredients: [] }, 1)
    ).toThrow();
    expect(() =>
      createRecipeTemplateSnapshot(source(), Number.MAX_VALUE)
    ).toThrow();
  });
});
