import { expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { recipe: { findMany: mocks.findMany } },
}));
import { loader } from "./admin_.receitas-tv._index";
const args = {
  request: new Request("http://localhost/admin/receitas-tv"),
  params: {},
  context: {},
};
beforeEach(() => vi.clearAllMocks());
it("redirects unauthenticated requests before querying recipes", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await loader(args);
  expect(response).toBeInstanceOf(Response);
  expect((response as Response).headers.get("Location")).toBe("/login");
  expect(mocks.findMany).not.toHaveBeenCalled();
});
it("converts Prisma thenables to tracked deferred promises", async () => {
  mocks.auth.mockResolvedValue({ id: "user" });
  const recipes = [{ id: "r1", name: "Massa", description: null, Item: null }];
  // PrismaPromise is a lazy thenable, not a native Promise.
  const query = {
    then: (resolve: (value: typeof recipes) => unknown) =>
      Promise.resolve(recipes).then(resolve),
  };
  mocks.findMany.mockReturnValue(query);
  const result = await loader(args);
  expect(result).not.toBeInstanceOf(Response);
  if (result instanceof Response) throw new Error("Unexpected redirect");
  expect(result.data.recipes).toBeInstanceOf(Promise);
  expect(
    (result.data.recipes as Promise<unknown> & { _tracked?: boolean })._tracked
  ).toBe(true);
  await expect(result.data.recipes).resolves.toEqual(recipes);
});
