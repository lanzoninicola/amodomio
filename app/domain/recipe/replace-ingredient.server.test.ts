import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./recipe-cost-sheet-recalculation-notification.server", () => ({
  notifyRecipeCostSheetRecalculationRequired: vi.fn(),
}));
import { notifyRecipeCostSheetRecalculationRequired } from "./recipe-cost-sheet-recalculation-notification.server";
import { replaceRecipeIngredient } from "./replace-ingredient.server";

function fixture() {
  const recipes = ["a", "b"].map((id) => ({
    id,
    name: id,
    status: "active",
    itemId: `product-${id}`,
    RecipeIngredient: [
      {
        id: `line-${id}`,
        ingredientItemId: "old",
        defaultLossPct: 3,
        notes: "Manter",
        sortOrderIndex: 2,
      },
    ],
  }));
  const variations = [
    { recipeIngredientId: "line-a", quantity: 0.125, unit: "KG", lossPct: 5 },
    { recipeIngredientId: "line-a", quantity: 0, unit: "G", lossPct: null },
    { recipeIngredientId: "line-b", quantity: 2.5, unit: "UN", lossPct: 0 },
  ];
  const tx = {
    item: { findFirst: vi.fn(async () => ({ id: "new" })) },
    recipe: { findMany: vi.fn(async () => recipes), updateMany: vi.fn() },
    recipeIngredient: {
      updateMany: vi.fn(async ({ data }: any) => {
        recipes.forEach((recipe) =>
          Object.assign(recipe.RecipeIngredient[0], data)
        );
        return { count: 2 };
      }),
    },
    recipeVariationIngredient: { updateMany: vi.fn(), deleteMany: vi.fn() },
  };
  const db = { $transaction: vi.fn(async (fn: any) => fn(tx)) } as any;
  return { recipes, variations, tx, db };
}
beforeEach(() => vi.clearAllMocks());
describe("replaceRecipeIngredient", () => {
  it("replaces multiple recipes without changing composition metadata or variation rows", async () => {
    const { db, tx, recipes, variations } = fixture();
    const original = structuredClone(variations);
    expect(
      await replaceRecipeIngredient(db, "old", "new", ["a", "b", "a"])
    ).toBe(2);
    expect(tx.recipeIngredient.updateMany).toHaveBeenCalledWith({
      where: { recipeId: { in: ["a", "b"] }, ingredientItemId: "old" },
      data: { ingredientItemId: "new" },
    });
    expect(recipes[0].RecipeIngredient[0]).toEqual({
      id: "line-a",
      ingredientItemId: "new",
      defaultLossPct: 3,
      notes: "Manter",
      sortOrderIndex: 2,
    });
    expect(variations).toEqual(original);
    expect(tx.recipeVariationIngredient.updateMany).not.toHaveBeenCalled();
    expect(tx.recipeVariationIngredient.deleteMany).not.toHaveBeenCalled();
    expect(notifyRecipeCostSheetRecalculationRequired).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      timeout: 30000,
    });
  });
  it.each([
    "duplicate",
    "missing-source",
    "archived",
    "self",
    "missing-recipe",
    "unavailable-target",
  ])("rejects %s before writing any recipe", async (reason) => {
    const { db, tx, recipes } = fixture();
    if (reason === "duplicate")
      recipes[1].RecipeIngredient.push({
        ...recipes[1].RecipeIngredient[0],
        ingredientItemId: "new",
      });
    if (reason === "missing-source") recipes[1].RecipeIngredient = [];
    if (reason === "archived") recipes[1].status = "archived";
    if (reason === "self") recipes[1].itemId = "new";
    if (reason === "missing-recipe") recipes.pop();
    if (reason === "unavailable-target")
      tx.item.findFirst.mockResolvedValue(null as any);
    await expect(
      replaceRecipeIngredient(db, "old", "new", ["a", "b"])
    ).rejects.toThrow();
    expect(tx.recipeIngredient.updateMany).not.toHaveBeenCalled();
  });
  it("rejects unchanged ingredient and empty selection", async () => {
    const { db } = fixture();
    await expect(
      replaceRecipeIngredient(db, "old", "old", ["a"])
    ).rejects.toThrow();
    await expect(
      replaceRecipeIngredient(db, "old", "new", [])
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("fails transaction on a concurrent composition change", async () => {
    const { db, tx } = fixture();
    tx.recipeIngredient.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      replaceRecipeIngredient(db, "old", "new", ["a", "b"])
    ).rejects.toThrow("composição mudou");
    expect(notifyRecipeCostSheetRecalculationRequired).not.toHaveBeenCalled();
  });
});
