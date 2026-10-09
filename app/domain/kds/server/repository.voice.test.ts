import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { kdsDailyOrderDetail: mocks },
}));
import { setOrderStatus } from "./repository.server";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({
    status: "aguardandoForno",
    assandoAt: null,
  });
});

it("starts baking and fulfills the oven request in the same database write", async () => {
  await setOrderStatus("order-id", "assando", { fulfillOvenRequest: true });
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "order-id" },
    data: {
      status: "assando",
      assandoAt: expect.any(Date),
      finalizadoAt: null,
      requestedForOven: false,
    },
  });
});

it("fulfills an oven request even when already baking, preserving its start time", async () => {
  const assandoAt = new Date("2026-10-09T15:00:00Z");
  mocks.findUnique.mockResolvedValue({ status: "assando", assandoAt });
  await setOrderStatus("order-id", "assando", { fulfillOvenRequest: true });
  expect(mocks.update.mock.calls[0][0].data).toEqual({
    status: "assando",
    assandoAt,
    finalizadoAt: null,
    requestedForOven: false,
  });
});

it("preserves the oven request for other statuses and existing manual callers", async () => {
  await setOrderStatus("order-id", "assando");
  expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty(
    "requestedForOven"
  );
  await setOrderStatus("order-id", "emProducao", { fulfillOvenRequest: true });
  expect(mocks.update.mock.calls[1][0].data).not.toHaveProperty(
    "requestedForOven"
  );
});

it("does not write when the target does not exist", async () => {
  mocks.findUnique.mockResolvedValue(null);
  await setOrderStatus("missing", "assando", { fulfillOvenRequest: true });
  expect(mocks.update).not.toHaveBeenCalled();
});
