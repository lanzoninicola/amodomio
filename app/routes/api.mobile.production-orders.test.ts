import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), recipes: vi.fn(), recipe: vi.fn(), plan: vi.fn(), create: vi.fn(), order: vi.fn(), apply: vi.fn(), save: vi.fn(), define: vi.fn(), suggest: vi.fn() }));
vi.mock("~/domain/auth/user-session.server", () => ({ getAuthenticatedBearerSession: m.auth }));
vi.mock("~/domain/production/production-order.server", () => ({
  applyOrderAction: m.apply, createProductionOrder: m.create, getProductionOrder: m.order,
  getRecipeProduction: m.recipe, listProductionOrders: m.list, listProductionRecipes: m.recipes,
  planForRecipe: m.plan, saveRecipeProduction: m.save,
  definePreparations: m.define, getPreparationSuggestions: m.suggest,
}));
import { action, loader } from "./api.mobile.production-orders";
const load = (query = "") => loader({ request: new Request(`https://test.local/api/mobile/production-orders${query}`), params: {}, context: {} });
const submit = (body: unknown, method = "POST") => action({ request: new Request("https://test.local/api/mobile/production-orders", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), params: {}, context: {} });
describe("tablet production API", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "u" } });
    m.recipe.mockResolvedValue({ id: "r", baseIngredientId: "f", ingredients: [{ id: "f", name: "Farinha", unit: "KG" }] });
    m.plan.mockReturnValue({ totals: [], inconsistencies: [] });
    m.suggest.mockResolvedValue([]); m.create.mockResolvedValue({ id: "o" }); m.order.mockResolvedValue({ id: "o", status: "planned" });
    m.list.mockResolvedValue([{ id: "o", plan: { large: "snapshot" }, Steps: [] }]);
  });
  it("requires bearer auth before reads and writes", async () => {
    m.auth.mockResolvedValue({ user: null });
    expect((await load()).status).toBe(401);
    expect((await submit({ intent: "create" })).status).toBe(401);
    expect(m.list).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it("omits large snapshots in the list and prevents caching", async () => {
    const result = await load(); expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(await result.json()).toEqual({ orders: [{ id: "o", Steps: [] }] });
  });
  it("filters the selected day on the server before the list limit", async () => {
    expect((await load("?date=2026-11-04")).status).toBe(200);
    expect(m.list).toHaveBeenCalledWith(undefined, {
      gte: new Date("2026-11-04T03:00:00Z"), lt: new Date("2026-11-05T03:00:00Z"),
    });
  });
  it("rejects invalid list dates", async () => {
    expect((await load("?date=2026-02-30")).status).toBe(400);
    expect(m.list).not.toHaveBeenCalled();
  });
  it("converts preview quantities to the recipe unit without creating an order", async () => {
    const result = await submit({ intent: "preview", recipeId: "r", quantity: 500, unit: "G" });
    expect(result.status).toBe(200); expect((await result.json()).baseQuantity).toBe(0.5);
    expect(m.plan).toHaveBeenCalledWith(expect.objectContaining({ id: "r" }), 0.5, "f");
    expect(m.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, "10", null])("rejects invalid quantities %s", async (quantity) => {
    expect((await submit({ intent: "create", recipeId: "r", quantity, unit: "KG", date: "2026-11-04" })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects incompatible units", async () => {
    expect((await submit({ intent: "preview", recipeId: "r", quantity: 1, unit: "UN" })).status).toBe(400);
    expect(m.plan).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "not-a-date", "2026-11-04T00:00:00Z"])("rejects invalid production day %s", async (date) => {
    expect((await submit({ intent: "create", recipeId: "r", quantity: 1, unit: "KG", date })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("creates with a server-converted base and returns the saved order", async () => {
    const response = await submit({ intent: "create", recipeId: "r", quantity: 1500, unit: "G", date: "2026-11-04" });
    expect(response.status).toBe(201);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ baseIngredientId: "f", baseQuantity: 1.5, productionDate: new Date("2026-11-04T15:00:00Z") }));
    expect((await response.json()).order.id).toBe("o");
  });
  it("passes the optional usage date to the order", async () => {
    await submit({ intent: "create", recipeId: "r", quantity: 1, unit: "KG", date: "2026-11-04", usageDate: "2026-11-05" });
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ usageDate: new Date("2026-11-05T15:00:00Z") }));
    await submit({ intent: "create", recipeId: "r", quantity: 1, unit: "KG", date: "2026-11-04" });
    expect(m.create).toHaveBeenLastCalledWith(expect.objectContaining({ usageDate: null }));
  });
  it("delegates transitions to the same domain rules as the web", async () => {
    expect((await submit({ intent: "step", id: "o", stepId: "s", to: "done" })).status).toBe(200);
    const [id, form] = m.apply.mock.calls[0]; expect(id).toBe("o"); expect(form.get("stepId")).toBe("s"); expect(form.get("to")).toBe("done");
  });
  it("returns domain transition errors without reporting success", async () => {
    m.apply.mockRejectedValueOnce(new Error("Conclua todas as etapas antes de finalizar."));
    const result = await submit({ intent: "finish", id: "o" }); expect(result.status).toBe(400);
    expect((await result.json()).message).toContain("Conclua todas"); expect(m.order).not.toHaveBeenCalled();
  });
  it("validates recipe configuration before delegating it", async () => {
    const result = await submit({ intent: "save-recipe", recipeId: "r", baseIngredientId: "f", preparations: [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: "wrong", unit: "KG" }] }] });
    expect(result.status).toBe(400); expect(m.save).not.toHaveBeenCalled();
  });
  it("saves configuration and returns the refreshed recipe", async () => {
    const preparations = [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 0.5, unit: "KG" }] }];
    expect((await submit({ intent: "save-recipe", recipeId: "r", baseIngredientId: "f", preparations })).status).toBe(200);
    expect(m.save).toHaveBeenCalledWith("r", expect.objectContaining({ baseIngredientId: "f" }));
  });
  it("uses the base ingredient chosen for this production", async () => {
    m.recipe.mockResolvedValue({ id: "r", baseIngredientId: null, ingredients: [{ id: "a", name: "Água", unit: "KG" }] });
    expect((await submit({ intent: "preview", recipeId: "r", baseIngredientId: "a", quantity: 1, unit: "KG" })).status).toBe(200);
    expect(m.plan).toHaveBeenCalledWith(expect.anything(), 1, "a");
  });
  it("defines preparations for an order and returns it with suggestions", async () => {
    const preparations = [{ name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 3, unit: "KG" }] }];
    const result = await submit({ intent: "define-preparations", id: "o", preparations, saveToRecipe: true });
    expect(result.status).toBe(200);
    expect(m.define).toHaveBeenCalledWith("o", expect.any(Array), { saveToRecipe: true });
    expect(await result.json()).toEqual({ order: { id: "o", status: "planned" }, suggestions: [] });
  });
  it("accepts an empty preparation list", async () => {
    expect((await submit({ intent: "define-preparations", id: "o", preparations: [] })).status).toBe(200);
    expect(m.define).toHaveBeenCalledWith("o", [], { saveToRecipe: false });
  });
  it("rejects unsupported methods and intents", async () => {
    expect((await submit({}, "PATCH")).status).toBe(405);
    expect((await submit({ intent: "delete" })).status).toBe(400);
    expect(m.apply).not.toHaveBeenCalled();
  });
});
