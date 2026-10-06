import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { $transaction: mocks.transaction },
}));
vi.mock("~/domain/cardapio/cardapio-cache.server", () => ({
  invalidateCardapioIndexCache: mocks.invalidate,
}));
import { action } from "./admin.gerenciamento.cardapio.groups";

const reorder = (ids: string) => {
  const body = new FormData();
  body.set("_intent", "reorder");
  body.set("ids", ids);
  return action({
    request: new Request(
      "http://localhost/admin/gerenciamento/cardapio/groups",
      { method: "POST", body }
    ),
    params: {},
    context: {},
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  mocks.transaction.mockImplementation((callback) =>
    callback({
      itemGroup: { findMany: mocks.findMany, update: mocks.update },
    })
  );
});
it("saves the complete order in one transaction and invalidates the menu cache", async () => {
  const response = await reorder('["b","a"]');
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  expect(mocks.update.mock.calls).toEqual([
    [{ where: { id: "b" }, data: { sortOrderIndex: 1000 } }],
    [{ where: { id: "a" }, data: { sortOrderIndex: 2000 } }],
  ]);
  expect(mocks.invalidate).toHaveBeenCalledTimes(1);
});
it.each(["invalid", "null", "[]", '["a","a"]', "[1]"])(
  "rejects malformed order %s",
  async (ids) => {
    expect((await reorder(ids)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  }
);
it.each(['["a"]', '["a","deleted"]', '["a","b","new"]'])(
  "rejects stale or deleted groups %s without writes",
  async (ids) => {
    expect((await reorder(ids)).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  }
);
it("returns a recoverable error when saving fails", async () => {
  mocks.transaction.mockRejectedValue(new Error("database unavailable"));
  expect((await reorder('["a","b"]')).status).toBe(500);
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
