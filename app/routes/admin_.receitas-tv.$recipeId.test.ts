import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), recipe: vi.fn() }));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({
  getMobileRecipe: mocks.recipe,
}));
import { loader } from "./admin_.receitas-tv.$recipeId";
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
  });
});
it("preserves missing recipe responses", async () => {
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.recipe.mockRejectedValue(
    new Response("Receita não encontrada", { status: 404 })
  );
  await expect(loader(args)).rejects.toMatchObject({ status: 404 });
});
