import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  transaction: vi.fn(),
  header: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  goal: vi.fn(),
  rows: vi.fn(),
  createRows: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { $transaction: mocks.transaction },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { authorize: mocks.auth, rateLimitCheck: mocks.limit },
}));
import { action } from "./api.kds.day.open";
const tx = {
  kdsDailyOrder: {
    findUnique: mocks.header,
    create: mocks.create,
    update: mocks.update,
  },
  financialDailyGoal: { findFirst: mocks.goal },
  kdsDailyOrderDetail: { findMany: mocks.rows, createMany: mocks.createRows },
};
async function open(date = "2026-10-12", method = "POST") {
  const response = await action({
    request: new Request("https://kds.test/api/kds/day/open", {
      method,
      ...(method === "POST"
        ? {
            body: JSON.stringify({ date }),
            headers: { "x-api-key": "test-key" },
          }
        : {}),
    }),
    params: {},
    context: {},
  } as any);
  return { status: response!.status, body: await response!.json() };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue({ status: 200 });
  mocks.limit.mockReturnValue({ success: true });
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.header.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    id: "day",
    operationStatus: "pending",
    openedAt: null,
  });
  mocks.goal.mockResolvedValue({ id: "goal" });
  mocks.rows.mockResolvedValue([]);
  mocks.createRows.mockImplementation(async ({ data }) => ({
    count: data.length,
  }));
});
it("opens a new day with the existing Atendimento default of 40 reservations", async () => {
  const result = await open();
  expect(result.body).toEqual({ ok: true, status: "OPENED", created: 40 });
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({
    dateInt: 20261012,
    financialDailyGoalId: "goal",
  });
  expect(mocks.createRows.mock.calls[0][0].data[0]).toMatchObject({
    commandNumber: 1,
    status: "pendente",
    orderAmount: 0,
  });
  expect(mocks.transaction.mock.calls[0][1].isolationLevel).toBe(
    "Serializable"
  );
});
it("keeps existing commands and appends only missing reservations", async () => {
  mocks.header.mockResolvedValue({
    id: "existing",
    operationStatus: "pending",
  });
  mocks.rows.mockResolvedValue([{ commandNumber: 1, sortOrderIndex: 8000 }]);
  expect((await open()).body.created).toBe(39);
  expect(mocks.createRows.mock.calls[0][0].data[0]).toMatchObject({
    commandNumber: 2,
    sortOrderIndex: 9000,
  });
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each(["OPENED", "REOPENED"])(
  "opening %s is idempotent",
  async (operationStatus) => {
    mocks.header.mockResolvedValue({ id: "day", operationStatus });
    expect((await open()).body.status).toBe(operationStatus);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.createRows).not.toHaveBeenCalled();
  }
);
it("reopens a closed day without creating reservations or changing existing orders", async () => {
  mocks.header.mockResolvedValue({ id: "day", operationStatus: "CLOSED" });
  expect((await open()).body).toEqual({
    ok: true,
    status: "REOPENED",
    created: 0,
  });
  expect(mocks.rows).not.toHaveBeenCalled();
  expect(mocks.createRows).not.toHaveBeenCalled();
});
it("rejects invalid dates, unauthorized clients and unsupported methods without writing", async () => {
  expect((await open("2026-02-30")).status).toBe(400);
  expect((await open("2026-10-12", "GET")).status).toBe(405);
  mocks.auth.mockReturnValue({ status: 401 });
  expect((await open()).status).toBe(401);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("retries a concurrent transaction before returning success", async () => {
  mocks.transaction.mockRejectedValueOnce(
    new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034",
      clientVersion: "test",
    })
  );
  expect((await open()).body.ok).toBe(true);
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});
it("a failed database operation returns an error instead of a success", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.update.mockRejectedValueOnce(new Error("offline"));
  expect((await open()).status).toBe(500);
  log.mockRestore();
});
