import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  recipe: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({
  getMobileRecipe: mocks.recipe,
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { recipeIngredient: { updateMany: mocks.updateMany } },
}));
import { loader, action } from "./admin_.receitas-tv.$recipeId";
const args = {
  request: new Request("http://localhost/admin/receitas-tv/recipe-1"),
  params: { recipeId: "recipe-1" },
  context: {},
};
beforeEach(() => vi.clearAllMocks());
it("requires login before querying a recipe", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await loader(args);
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/login");
  expect(mocks.recipe).not.toHaveBeenCalled();
});
it("returns the shared recipe data without caching", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockResolvedValue({
    id: "recipe-1",
    name: "Massa",
    ingredients: [],
  });
  const response = await loader(args);
  expect(mocks.recipe).toHaveBeenCalledWith("recipe-1");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    recipe: { id: "recipe-1", name: "Massa", ingredients: [] },
    configuration: { scaleFactor: 1, selectedUnits: {} },
  });
});
it("preserves missing recipe responses", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockRejectedValue(
    new Response("Receita não encontrada", { status: 404 })
  );
  await expect(loader(args)).rejects.toMatchObject({ status: 404 });
});

it("restores the scale and units when returning from templates", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockResolvedValue({
    id: "recipe-1",
    name: "Massa",
    ingredients: [],
  });
  const search = new URLSearchParams({
    scaleFactor: "2.5",
    selectedUnits: JSON.stringify({ flour: "G" }),
  });
  const response = await loader({
    ...args,
    request: new Request(
      `http://localhost/admin/receitas-tv/recipe-1?${search}`
    ),
  });
  expect((await response.json()).configuration).toEqual({
    scaleFactor: 2.5,
    selectedUnits: { flour: "G" },
  });
});
it("falls back safely for invalid configuration", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockResolvedValue({ id: "recipe-1" });
  const response = await loader({
    ...args,
    request: new Request(
      "http://localhost/admin/receitas-tv/recipe-1?scaleFactor=-1"
    ),
  });
  expect((await response.json()).configuration).toEqual({
    scaleFactor: 1,
    selectedUnits: {},
  });
});
async function saveUnit(unit = "G", ingredientId = "flour") {
  return action({
    ...args,
    request: new Request(args.request.url, {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-display-unit",
        ingredientId,
        unit,
      }),
    }),
  });
}
it("saves the selected unit only for an ingredient in the current recipe", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockResolvedValue({
    ingredients: [{ id: "flour", displayUnits: [{ unit: "G", factor: 1000 }] }],
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  expect(await (await saveUnit()).json()).toEqual({
    savedDisplayUnit: "G",
    ingredientId: "flour",
  });
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id: "flour", recipeId: "recipe-1" },
    data: { mobileDisplayUnit: "G" },
  });
});
it.each([
  ["ML", "flour"],
  ["G", "foreign"],
])(
  "rejects unsupported units and foreign ingredients %s %s",
  async (unit, ingredientId) => {
    mocks.auth.mockResolvedValue({ id: "user-1" });
    mocks.recipe.mockResolvedValue({
      ingredients: [
        { id: "flour", displayUnits: [{ unit: "G", factor: 1000 }] },
      ],
    });
    expect((await saveUnit(unit, ingredientId)).status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  }
);
it("requires login before saving a unit", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await saveUnit()).headers.get("Location")).toBe("/login");
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
