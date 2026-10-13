import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  recipe: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  unit: vi.fn(),
  templates: vi.fn(),
  template: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.auth,
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { recipe: { findMany: mocks.list } },
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({
  getMobileRecipe: mocks.recipe,
}));
vi.mock("~/domain/recipe/recipe-templates.server", () => ({
  createRecipeTemplate: mocks.create,
  deleteRecipeTemplate: mocks.remove,
  saveRecipeDisplayUnit: mocks.unit,
  listRecipeTemplates: mocks.templates,
  getRecipeTemplate: mocks.template,
}));
import { loader, action } from "./api.mobile.recipes";
function args(body?: unknown, search = "") {
  return {
    request: new Request(
      `https://app.test/api/mobile/recipes${search}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
    ),
    params: {},
    context: {},
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user" } });
  mocks.recipe.mockResolvedValue({ id: "r" });
  mocks.list.mockResolvedValue([]);
  mocks.templates.mockResolvedValue([]);
});
it("requires a bearer session before any recipe access or mutation", async () => {
  mocks.auth.mockResolvedValue({ user: null });
  expect((await loader(args())).status).toBe(401);
  expect(
    (await action(args({ recipeId: "r", intent: "delete-template" }))).status
  ).toBe(401);
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("lists only active recipes without caching", async () => {
  const result = await loader(args());
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.list.mock.calls[0][0].where).toEqual({ status: "active" });
});
it("scopes template reads to their recipe", async () => {
  mocks.template.mockResolvedValue({ id: "t" });
  await loader(args(undefined, "?recipeId=r&templateId=t"));
  expect(mocks.template).toHaveBeenCalledWith("r", "t");
});
it("reuses snapshot creation and passes scale and units unchanged", async () => {
  mocks.create.mockResolvedValue(Response.json({ createdTemplateId: "t" }));
  const result = await action(
    args({
      recipeId: "r",
      intent: "create-template",
      name: "Lote",
      scaleFactor: 2,
      selectedUnits: { ingredient: "KG" },
    })
  );
  expect(await result.json()).toEqual({ createdTemplateId: "t" });
  const [id, form] = mocks.create.mock.calls[0];
  expect(id).toBe("r");
  expect(form.get("scaleFactor")).toBe("2");
  expect(JSON.parse(form.get("selectedUnits"))).toEqual({ ingredient: "KG" });
});
it("forwards validated unit and deletion operations to recipe-scoped services", async () => {
  mocks.unit.mockResolvedValue(Response.json({ savedDisplayUnit: "KG" }));
  mocks.remove.mockResolvedValue(Response.json({ deletedTemplateId: "t" }));
  await action(
    args({
      recipeId: "r",
      intent: "save-display-unit",
      ingredientId: "i",
      unit: "KG",
    })
  );
  await action(
    args({ recipeId: "r", intent: "delete-template", templateId: "t" })
  );
  expect(mocks.unit.mock.calls[0][0]).toBe("r");
  expect(mocks.unit.mock.calls[0][1].get("ingredientId")).toBe("i");
  expect(mocks.remove.mock.calls[0][1].get("templateId")).toBe("t");
});
it("returns service validation errors to the app", async () => {
  mocks.create.mockResolvedValue(
    Response.json({ error: "Quantidades inválidas." }, { status: 400 })
  );
  const result = await action(
    args({ recipeId: "r", intent: "create-template" })
  );
  expect(result.status).toBe(400);
  expect((await result.json()).message).toBe("Quantidades inválidas.");
});
it("rejects unknown operations and missing recipe ids", async () => {
  expect((await action(args({ intent: "create-template" }))).status).toBe(400);
  expect(
    (await action(args({ recipeId: "r", intent: "unknown" }))).status
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("preserves not-found responses", async () => {
  mocks.recipe.mockRejectedValue(
    new Response("Receita não encontrada", { status: 404 })
  );
  const result = await loader(args(undefined, "?recipeId=missing"));
  expect(result.status).toBe(404);
});
it("rejects malformed and oversized bodies before mutations", async () => {
  expect((await action(args(null))).status).toBe(400);
  const request = new Request("https://app.test/api/mobile/recipes", {
    method: "POST",
    body: "{broken",
  });
  expect((await action({ ...args(), request })).status).toBe(400);
  expect(
    (
      await action(
        args({
          recipeId: "r",
          intent: "create-template",
          name: "a".repeat(17000),
        })
      )
    ).status
  ).toBe(413);
  expect(mocks.create).not.toHaveBeenCalled();
});
