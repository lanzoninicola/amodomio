import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ fetch: vi.fn(), list: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({ default: { suitableOrderInbox: { findMany: m.findMany, upsert: m.upsert } } }));
vi.mock("./suitable-client.server", async (original) => ({ ...await original<typeof import("./suitable-client.server")>(), fetchSuitableOrder: m.fetch, listSuitableOrders: m.list }));
import { reconcileSuitableOrders, syncInboxOrder } from "./suitable-inbox.server";
beforeEach(() => { vi.clearAllMocks(); m.upsert.mockResolvedValue({}); });
it("retries failed pending orders while preserving imported and dismissed orders", async () => {
  m.list.mockResolvedValue({ count: 5, page_size: 100, results: [1, 2, 3, 4, 5].map(id => ({ id, status: "pending" })) });
  m.findMany.mockResolvedValue([
    { suitableOrderId: 1, status: "pending", fetchError: "timeout" },
    { suitableOrderId: 2, status: "imported", fetchError: "old error" },
    { suitableOrderId: 3, status: "dismissed", fetchError: "old error" },
    { suitableOrderId: 4, status: "pending", fetchError: null },
  ]);
  m.fetch.mockResolvedValue({ paid: false });
  expect(await reconcileSuitableOrders()).toMatchObject({ missing: 2, recovered: 2 });
  expect(m.fetch.mock.calls.map(args => args[0])).toEqual([1, 5]);
});
it("persists and logs order context and clears fetchError after recovery", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  m.fetch.mockRejectedValueOnce(new Error("HTTP 403; etapa=auth; corpo=forbidden"));
  expect(await syncInboxOrder(1902, "evt", "new_order")).toMatchObject({ ok: false, error: expect.stringContaining("etapa=fetch_order") });
  expect(m.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ fetchError: expect.stringContaining("HTTP 403") }) }));
  expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ orderId: 1902, stage: "fetch_order" }));
  m.fetch.mockResolvedValueOnce({ paid: true });
  expect(await syncInboxOrder(1902, null, "retry")).toEqual({ ok: true });
  expect(m.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ fetchError: null }) }));
  log.mockRestore();
});
