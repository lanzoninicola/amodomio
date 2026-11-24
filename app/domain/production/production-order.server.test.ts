import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  recipe: vi.fn(), config: vi.fn(), update: vi.fn(), step: vi.fn(),
  find: vi.fn(), lock: vi.fn(), transaction: vi.fn(), templateFind: vi.fn(), templateCreate: vi.fn(), templateUpdate: vi.fn(),
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({ getMobileRecipe: mocks.recipe }));
vi.mock("~/lib/prisma/client.server", () => ({ default: {
  recipe: { findUnique: mocks.config }, $transaction: mocks.transaction,
  productionOrderTemplate: { findUnique: mocks.templateFind, create: mocks.templateCreate, update: mocks.templateUpdate },
} }));
import { applyOrderAction, createProductionOrderTemplate, saveRecipeProduction } from "./production-order.server";
const form = (values: Record<string, string>) => ({ get: (key: string) => values[key] });

describe("production order server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn) => fn({
      $queryRaw: mocks.lock,
      productionOrder: { findUnique: mocks.find, update: mocks.update },
      productionOrderStep: { update: mocks.step },
    }));
    mocks.find.mockResolvedValue({ status: "in_progress", Steps: [
      { id: "prep", kind: "preparation", status: "done" },
      { id: "final", kind: "final", status: "pending" },
    ] });
    mocks.recipe.mockResolvedValue({ id: "r", name: "Pão", ingredients: [
      { id: "f", name: "Farinha", quantity: 10, unit: "KG" },
    ] });
    mocks.config.mockResolvedValue({ productionBaseRecipeIngredientId: "f", Preparations: [] });
  });
  it("rejects excessive preparations before any write", async () => {
    await expect(saveRecipeProduction("r", { baseIngredientId: "f", preparations: [{
      name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 11000, unit: "G" }],
    }] })).rejects.toThrow("mais que o total");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("creates a reusable OP with independently calculated recipes", async () => {
    await createProductionOrderTemplate({ name: "Pães", items: [
      { recipeId: "r", baseIngredientId: "f", baseQuantity: 20, calculationMode: "ingredient", targetQuantity: 20, targetUnit: "KG" },
      { recipeId: "r", baseIngredientId: "f", baseQuantity: 30, calculationMode: "yield", targetQuantity: 3, targetUnit: "rendimentos" },
    ] });
    const data = mocks.templateCreate.mock.calls[0][0].data;
    expect(data.items.map((item: any) => item.plan.totals[0].quantity)).toEqual([20, 30]);
    expect(data.plan).toEqual(data.items[0].plan);
  });
  it("preserves existing recipe snapshots when editing only the OP name", async () => {
    const plan = { baseIngredientId: "f", productMix: [], totals: [{ id: "f", name: "Farinha", quantity: 20, unit: "KG" }] };
    const item = { version: 1, recipeId: "r", recipeName: "Pão", baseIngredientId: "f", baseIngredient: "Farinha", baseQuantity: 20, baseUnit: "KG", calculationMode: "ingredient", targetQuantity: 20, targetUnit: "KG", plan };
    mocks.templateFind.mockResolvedValue({ id: "t", archivedAt: null, items: [item], plan });
    await createProductionOrderTemplate({ templateId: "t", name: "Novo nome", items: [{ ...item, productMix: [] }] });
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(mocks.templateUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t" }, data: expect.objectContaining({ name: "Novo nome", items: [item] }) }));
  });
  it.each([-1, NaN, Infinity])("rejects invalid preparation quantity %s", async (quantity) => {
    await expect(saveRecipeProduction("r", { baseIngredientId: "f", preparations: [{
      name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity, unit: "KG" }],
    }] })).rejects.toThrow("quantidade inválida");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("locks the order before reading and changing a step", async () => {
    await applyOrderAction("o", form({ intent: "step", stepId: "final", to: "in_progress" }));
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.find.mock.invocationCallOrder[0]);
    expect(mocks.step).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "in_progress", completedAt: null } }));
  });
  it("allows completing a pending step directly", async () => {
    await applyOrderAction("o", form({ intent: "step", stepId: "final", to: "done" }));
    expect(mocks.step).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "done" }) }));
  });
  it("rejects invalid step transitions", async () => {
    mocks.find.mockResolvedValue({ status: "in_progress", Steps: [
      { id: "prep", kind: "preparation", status: "done" },
      { id: "final", kind: "final", status: "done" },
    ] });
    await expect(applyOrderAction("o", form({ intent: "step", stepId: "final", to: "in_progress" }))).rejects.toThrow("Transição");
    expect(mocks.step).not.toHaveBeenCalled();
  });
  it("rejects reopening a preparation after final mixing starts", async () => {
    mocks.find.mockResolvedValue({ status: "in_progress", Steps: [
      { id: "prep", kind: "preparation", status: "done" },
      { id: "final", kind: "final", status: "in_progress" },
    ] });
    await expect(applyOrderAction("o", form({ intent: "step", stepId: "prep", to: "in_progress" }))).rejects.toThrow("Reabra a mistura");
    expect(mocks.step).not.toHaveBeenCalled();
  });
  it("rejects finishing with incomplete steps", async () => {
    await expect(applyOrderAction("o", form({ intent: "finish" }))).rejects.toThrow("Conclua todas");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects invalid produced quantities instead of discarding them", async () => {
    mocks.find.mockResolvedValue({ status: "in_progress", Steps: [{ status: "done" }] });
    await expect(applyOrderAction("o", form({ intent: "finish", producedQuantity: "-1" }))).rejects.toThrow("maior que zero");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reorders preparations and keeps the final mix last", async () => {
    mocks.find.mockResolvedValue({ status: "planned", Steps: [
      { id: "a", kind: "preparation", status: "pending" },
      { id: "b", kind: "preparation", status: "pending" },
      { id: "final", kind: "final", status: "pending" },
    ] });
    await applyOrderAction("o", form({ intent: "reorder", stepIds: "b,a" }));
    expect(mocks.step).toHaveBeenCalledWith({ where: { id: "b" }, data: { sortOrder: 0 } });
    expect(mocks.step).toHaveBeenCalledWith({ where: { id: "a" }, data: { sortOrder: 1 } });
    expect(mocks.step).toHaveBeenCalledWith({ where: { id: "final" }, data: { sortOrder: 2 } });
  });
  it("rejects a reorder that includes the final mix or unknown steps", async () => {
    mocks.find.mockResolvedValue({ status: "planned", Steps: [
      { id: "a", kind: "preparation", status: "pending" },
      { id: "final", kind: "final", status: "pending" },
    ] });
    await expect(applyOrderAction("o", form({ intent: "reorder", stepIds: "final" }))).rejects.toThrow("inválida");
    await expect(applyOrderAction("o", form({ intent: "reorder", stepIds: "a,x" }))).rejects.toThrow("inválida");
    expect(mocks.step).not.toHaveBeenCalled();
  });
});
