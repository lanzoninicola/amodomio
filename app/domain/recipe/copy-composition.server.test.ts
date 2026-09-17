import { describe, expect, it, vi } from "vitest";
vi.mock("./recipe-cost-sheet-recalculation-notification.server", () => ({ notifyRecipeCostSheetRecalculationRequired: vi.fn() }));
import { copyRecipeComposition } from "./copy-composition.server";

function fixture() {
  const source = { id: "source", itemId: "source-item", RecipeIngredient: [{ ingredientItemId: "flour", defaultLossPct: 5, notes: "Peneirar", sortOrderIndex: 0, IngredientItem: { consumptionUm: "KG" }, RecipeVariationIngredient: [{ itemVariationId: "source-large", quantity: 2, unit: "KG", lossPct: null, ItemVariation: { variationId: "large" } }] }] };
  const tx = {
    recipe: { findUnique: vi.fn(async ({ where }: any) => where.id === "source" ? source : { id: "target", itemId: "target-item" }) },
    itemVariation: { findMany: vi.fn(async ({ where }: any) => [{ id: where.itemId === "source-item" ? "source-large" : "target-large", variationId: "large", isReference: true, Variation: { name: "Grande" } }]), create: vi.fn(), findUnique: vi.fn() },
    recipeIngredient: { findMany: vi.fn(async () => [{ id: "target-flour", ingredientItemId: "flour", sortOrderIndex: 0 }]), create: vi.fn(async () => ({ id: "new-ingredient" })) },
    recipeVariationIngredient: { upsert: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (fn: any) => fn(tx)) } };
}
describe("copyRecipeComposition", () => {
  it("maps by global variation, uses target IDs and preserves effective source loss", async () => {
    const { tx, db } = fixture();
    await copyRecipeComposition(db, "target", "source", true);
    expect(tx.recipeVariationIngredient.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { recipeIngredientId_itemVariationId: { recipeIngredientId: "target-flour", itemVariationId: "target-large" } },
      update: { quantity: 2, unit: "KG", lossPct: 5 },
    }));
    expect(tx.recipeIngredient.create).not.toHaveBeenCalled();
  });
  it("keeps existing quantities when checkbox is unchecked", async () => {
    const { tx, db } = fixture();
    await copyRecipeComposition(db, "target", "source", false);
    expect(tx.recipeVariationIngredient.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ quantity: 0 }) }));
    expect(tx.itemVariation.create).not.toHaveBeenCalled();
  });
  it("creates independent ingredient records", async () => {
    const { tx, db } = fixture();
    tx.recipeIngredient.findMany.mockResolvedValue([]);
    await copyRecipeComposition(db, "target", "source", true);
    expect(tx.recipeIngredient.create).toHaveBeenCalledWith({ data: { recipeId: "target", ingredientItemId: "flour", defaultLossPct: 5, notes: "Peneirar", sortOrderIndex: 0 } });
  });
  it("creates missing variations on the destination item", async () => {
    const { tx, db } = fixture();
    tx.itemVariation.findMany.mockResolvedValueOnce([{ id: "source-large", variationId: "large", isReference: true, Variation: { name: "Grande" } }]).mockResolvedValueOnce([]);
    await copyRecipeComposition(db, "target", "source", true);
    expect(tx.itemVariation.create).toHaveBeenCalledWith({ data: { itemId: "target-item", variationId: "large", recipeId: "target", isReference: true } });
  });
  it("rejects archived variation conflicts", async () => {
    const { tx, db } = fixture();
    tx.itemVariation.findMany.mockResolvedValueOnce([{ id: "source-large", variationId: "large", isReference: true, Variation: { name: "Grande" } }]).mockResolvedValueOnce([]);
    tx.itemVariation.findUnique.mockResolvedValue({ id: "archived" });
    await expect(copyRecipeComposition(db, "target", "source", true)).rejects.toThrow("arquivada");
    expect(tx.recipeIngredient.create).not.toHaveBeenCalled();
  });
  it("rejects copying the same recipe before opening a transaction", async () => {
    const { db } = fixture();
    await expect(copyRecipeComposition(db, "target", "target", true)).rejects.toThrow("outra receita");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
