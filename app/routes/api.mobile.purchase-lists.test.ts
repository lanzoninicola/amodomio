import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  catalog: vi.fn(),
  lists: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.auth,
}));
vi.mock("~/domain/purchase/purchase-shopping-list.server", () => ({
  listMobilePurchaseCatalog: mocks.catalog,
  listMobilePurchaseLists: mocks.lists,
  getMobilePurchaseList: mocks.get,
  createMobilePurchaseList: mocks.create,
  updateMobilePurchaseListItem: mocks.update,
}));
import { loader, action } from "./api.mobile.purchase-lists";
const args = (body?: unknown) => ({
  request: new Request(
    "https://app.test/api/mobile/purchase-lists",
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
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u" } });
  mocks.catalog.mockResolvedValue([]);
  mocks.lists.mockResolvedValue([]);
});
it("requires authentication before reads and writes", async () => {
  mocks.auth.mockResolvedValue({ user: null });
  expect((await loader(args())).status).toBe(401);
  expect(
    (await action(args({ intent: "create", name: "x", items: [] }))).status
  ).toBe(401);
  expect(mocks.catalog).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("does not cache catalog and lists", async () => {
  expect((await loader(args())).headers.get("Cache-Control")).toBe("no-store");
});
it("rejects malformed creation before writing", async () => {
  expect(
    (await action(args({ intent: "create", name: "x", items: [null] }))).status
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("does not toggle an item from another list", async () => {
  mocks.get.mockResolvedValue({ id: "a", Items: [{ id: "item-a" }] });
  expect(
    (
      await action(
        args({
          intent: "toggle",
          listId: "a",
          listItemId: "item-b",
          purchased: true,
        })
      )
    ).status
  ).toBe(404);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("preserves the recorded supplier when marking purchased", async () => {
  mocks.get.mockResolvedValue({
    id: "a",
    Items: [{ id: "item-a", supplierId: "supplier" }],
  });
  expect(
    (
      await action(
        args({
          intent: "toggle",
          listId: "a",
          listItemId: "item-a",
          purchased: true,
        })
      )
    ).status
  ).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({
    listId: "a",
    listItemId: "item-a",
    purchased: true,
    supplierId: "supplier",
  });
});
