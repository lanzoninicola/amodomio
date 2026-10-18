import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  auth: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { kdsDailyOrderDetail: { findMany: mocks.rows } },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { rateLimitCheck: mocks.limit, authorize: mocks.auth },
}));
import { action } from "./api.kds.orders.status";
const input = {
  date: "2026-10-18",
  orders: [
    { commandNumber: 1, customerPhone: "+55 (46) 99105-2049" },
    { commandNumber: 2, customerPhone: "46999990000" },
  ],
};
async function query(body: unknown = input, method = "POST") {
  const response = await action({
    request: new Request("https://kds.test/api/kds/orders/status", {
      method,
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    }),
    params: {},
    context: {},
  } as any);
  return { response, body: await response.json() };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue({ status: 200 });
  mocks.limit.mockReturnValue({ success: true });
  mocks.rows.mockResolvedValue([]);
});
it("matches the number AND normalized phone with one query scoped to the date and active rows", async () => {
  mocks.rows.mockResolvedValue([
    { commandNumber: 1, customerPhone: "46991052049" },
    { commandNumber: 2, customerPhone: "46988880000" },
  ]);
  const { body, response } = await query();
  expect(body.statuses.map((row: any) => row.exists)).toEqual([true, false]);
  expect(body.date).toBe(input.date);
  expect(mocks.rows).toHaveBeenCalledTimes(1);
  expect(mocks.rows).toHaveBeenCalledWith({
    where: {
      dateInt: 20261018,
      deletedAt: null,
      commandNumber: { in: [1, 2] },
    },
    select: { commandNumber: true, customerPhone: true },
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it.each([
  { ...input, date: "2026-02-30" },
  { ...input, orders: [] },
  { ...input, orders: Array(51).fill(input.orders[0]) },
  { ...input, orders: [{ commandNumber: 0, customerPhone: "46991052049" }] },
  { ...input, orders: [{ commandNumber: 1, customerPhone: "" }] },
])("rejects invalid dates, identities and oversized batches", async (body) => {
  expect((await query(body)).response.status).toBe(400);
  expect(mocks.rows).not.toHaveBeenCalled();
});
it("requires authorization", async () => {
  mocks.auth.mockReturnValue({ status: 401 });
  expect((await query()).response.status).toBe(401);
  expect(mocks.rows).not.toHaveBeenCalled();
});
it("enforces the rate limit and POST method", async () => {
  mocks.limit.mockReturnValue({ success: false });
  expect((await query()).response.status).toBe(429);
  expect((await query(input, "GET")).response.status).toBe(405);
  expect(mocks.rows).not.toHaveBeenCalled();
});
