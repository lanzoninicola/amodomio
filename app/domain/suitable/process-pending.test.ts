import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ settings: vi.fn(), rows: vi.fn(), sync: vi.fn(), launch: vi.fn(), update: vi.fn() }));
vi.mock("./suitable-settings.server", () => ({ getSuitableSettings: m.settings }));
vi.mock("./suitable-inbox.server", () => ({ syncInboxOrder: m.sync }));
vi.mock("./import-order.server", () => ({ importSuitableInboxOrder: m.launch }));
vi.mock("~/lib/prisma/client.server", () => ({ default: { suitableOrderInbox: { findMany: m.rows, updateMany: m.update } } }));
import { processSuitablePendingOrders } from "./process-pending.server";
beforeEach(() => { vi.clearAllMocks(); m.settings.mockResolvedValue({ paused: false }); });
it("automatically launches ready orders and refetches failed ones without operator action", async () => {
  m.rows.mockResolvedValue([
    { id: "ready", suitableOrderId: 1, details: { display_number: "1" }, fetchError: null },
    { id: "retry", suitableOrderId: 2, details: null, fetchError: "timeout", lastEventId: "evt" },
  ]);
  await processSuitablePendingOrders();
  expect(m.launch).toHaveBeenCalledWith("ready");
  expect(m.sync).toHaveBeenCalledWith(2, "evt", "auto_retry");
  expect(m.rows).toHaveBeenCalledWith(expect.objectContaining({ take: 3, where: expect.objectContaining({ status: "pending", updatedAt: expect.any(Object) }) }));
});
it("does nothing while paused", async () => {
  m.settings.mockResolvedValue({ paused: true });
  await processSuitablePendingOrders();
  expect(m.rows).not.toHaveBeenCalled();
});
