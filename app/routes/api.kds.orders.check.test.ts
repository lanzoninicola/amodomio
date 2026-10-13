import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  header: vi.fn(),
  rows: vi.fn(),
  stock: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    kdsDailyOrder: { findUnique: mocks.header },
    kdsDailyOrderDetail: { findMany: mocks.rows },
  },
}));
vi.mock("~/domain/kds/dough-stock.server", () => ({
  getDoughStock: mocks.stock,
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { rateLimitCheck: () => ({ success: true }), authorize: mocks.auth },
}));
import { action } from "./api.kds.orders.check";
const input = {
  date: "2026-10-11",
  commandNumber: 1,
  orderItems: [
    {
      name: "Pizza",
      quantity: 2,
      size: "I",
      flavors: ["Calabresa"],
      notes: [],
    },
  ],
};
async function check(body = input) {
  const response = await action({
    request: new Request("https://kds.test/api/kds/orders/check", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  } as any);
  return { status: response.status, body: await response.json() };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue({ status: 200 });
  mocks.header.mockResolvedValue({ operationStatus: "OPENED" });
  mocks.rows.mockResolvedValue([]);
  mocks.stock.mockResolvedValue({
    effective: { F: 0, M: 0, P: 0, I: 3, FT: 0 },
  });
});
it("subtracts reserved dough and reports advisory shortage without blocking sending", async () => {
  mocks.rows.mockResolvedValue([{ commandNumber: 2, size: '{"I":2}' }]);
  const result = await check();
  expect(result.body.check).toMatchObject({
    exists: false,
    available: { I: 1 },
    shortages: ["I"],
    canSend: true,
  });
});
it("allows updating existing commands even from other channels", async () => {
  mocks.rows.mockResolvedValue([
    {
      commandNumber: 1,
      status: "finalizado",
      channel: "IFOOD",
      size: '{"I":1}',
    },
  ]);
  expect((await check()).body.check).toMatchObject({
    exists: true,
    status: "finalizado",
    canSend: true,
  });
});
it("allows an empty reservation", async () => {
  mocks.rows.mockResolvedValue([
    {
      commandNumber: 1,
      status: "pendente",
      size: "{}",
      orderAmount: 0,
      motoValue: 0,
    },
  ]);
  expect((await check()).body.check).toMatchObject({
    exists: false,
    canSend: true,
  });
});
it("exposes missing stock instead of claiming sufficient stock", async () => {
  mocks.stock.mockResolvedValue(null);
  expect((await check()).body.check).toMatchObject({
    available: null,
    shortages: [],
    canSend: true,
  });
});
it("allows closed days for automatic reopening, but blocks missing days", async () => {
  mocks.header.mockResolvedValue({ operationStatus: "CLOSED" });
  expect((await check()).body.check).toMatchObject({
    dayStatus: "CLOSED",
    canSend: true,
  });
  mocks.header.mockResolvedValue(null);
  expect((await check()).body.check.canSend).toBe(false);
});
it("validates calendar dates before querying the database", async () => {
  expect((await check({ ...input, date: "2026-02-30" })).status).toBe(400);
  expect(mocks.rows).not.toHaveBeenCalled();
});
it("requires server authorization before consulting stock", async () => {
  mocks.auth.mockReturnValue({ status: 401 });
  expect((await check()).status).toBe(401);
  expect(mocks.stock).not.toHaveBeenCalled();
});
