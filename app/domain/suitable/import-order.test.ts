import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  settings: vi.fn(), inbox: vi.fn(), ensure: vi.fn(), history: vi.fn(), query: vi.fn(), current: vi.fn(),
  slot: vi.fn(), create: vi.fn(), aggregate: vi.fn(), update: vi.fn(), header: vi.fn(), headerUpdate: vi.fn(), inboxUpdate: vi.fn(),
}));
vi.mock("./suitable-settings.server", () => ({ getSuitableSettings: m.settings }));
vi.mock("~/domain/kds/server/repository.server", () => ({ ensureHeader: m.ensure }));
vi.mock("~/domain/crm/order-history.server", () => ({ syncKdsOrderHistory: m.history }));
vi.mock("~/domain/kds/import-order.server", () => ({ emptyReservation: () => true }));
vi.mock("~/lib/prisma/client.server", () => ({ default: {
  suitableOrderInbox: { findUnique: m.inbox },
  $transaction: (fn: any) => fn({
    $queryRaw: m.query,
    suitableOrderInbox: { findUnique: m.current, update: m.inboxUpdate },
    suitableSettings: { findUnique: vi.fn().mockResolvedValue({ paused: false }) },
    kdsDailyOrderDetail: { findFirst: m.slot, create: m.create, aggregate: m.aggregate, update: m.update },
    kdsDailyOrder: { findUniqueOrThrow: m.header, update: m.headerUpdate },
  }),
} }));
import { importSuitableInboxOrder, suitableOrderDay } from "./import-order.server";
beforeEach(() => {
  vi.clearAllMocks();
  m.settings.mockResolvedValue({ paused: false });
  m.inbox.mockResolvedValue({ id: "inbox", status: "pending", createdAt: new Date("2026-11-25T00:51:00Z"), details: {
    id: 1902, display_number: "1", total: "369.70", paid: false,
    customer: { name: "Cliente" }, items: [{ name: "Pizzas PEQUENO", quantity: 1, options: [] }], payment: { methods: [] },
  } });
  m.ensure.mockResolvedValue({ id: "day" });
  m.current.mockResolvedValue({ status: "pending" });
  m.slot.mockResolvedValue(null);
  m.create.mockResolvedValue({ id: "row", commandNumber: 1 });
  m.aggregate.mockResolvedValue({ _max: { sortOrderIndex: null }, _sum: { orderAmount: 369.7 } });
  m.header.mockResolvedValue({ operationStatus: "CLOSED" });
  m.update.mockResolvedValue({ id: "row", commandNumber: 1 });
});
it("automatically opens the day and records the visible number, items and inbox link", async () => {
  expect(await importSuitableInboxOrder("inbox")).toMatchObject({ id: "row", commandNumber: 1, dateInt: 20261124 });
  expect(m.headerUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationStatus: "REOPENED" }) }));
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suitableOrderId: 1902, commandNumber: 1, status: "novoPedido", size: JSON.stringify({ F: 0, M: 0, P: 1, I: 0, FT: 0 }) }) }));
  expect(m.inboxUpdate).toHaveBeenCalledWith({ where: { id: "inbox" }, data: { status: "imported", importedRowId: "row", fetchError: null } });
  expect(m.history).toHaveBeenCalled();
});
it("does not launch while paused", async () => {
  m.settings.mockResolvedValue({ paused: true });
  expect(await importSuitableInboxOrder("inbox")).toMatchObject({ skipped: true, reason: "paused" });
  expect(m.update).not.toHaveBeenCalled();
});
it("rechecks status under lock so competing deliveries cannot import twice", async () => {
  m.current.mockResolvedValue({ status: "imported" });
  expect(await importSuitableInboxOrder("inbox")).toMatchObject({ skipped: true });
  expect(m.update).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("uses Sao Paulo day rather than UTC midnight", () => {
  expect(suitableOrderDay(new Date("2026-11-25T00:51:00Z"))).toBe("2026-11-24");
});
