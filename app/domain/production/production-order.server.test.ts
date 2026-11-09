import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  recipe: vi.fn(), config: vi.fn(), update: vi.fn(), step: vi.fn(),
  find: vi.fn(), lock: vi.fn(), transaction: vi.fn(),
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({ getMobileRecipe: mocks.recipe }));
vi.mock("~/lib/prisma/client.server", () => ({ default: {
  recipe: { findUnique: mocks.config }, $transaction: mocks.transaction,
} }));
import { applyOrderAction, saveRecipeProduction } from "./production-order.server";
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
