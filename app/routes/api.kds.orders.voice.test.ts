import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  setStatus: vi.fn(),
  setOven: vi.fn(),
  setCut: vi.fn(),
  bearer: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({ default: {} }));
vi.mock("~/domain/kds/server", () => ({
  getOrderForApiById: mocks.getOrder,
  setOrderStatus: mocks.setStatus,
  setOrderRequestedForOven: mocks.setOven,
  setOrderRequiresCut: mocks.setCut,
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.bearer,
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: {
    rateLimitCheck: () => ({ success: true }),
    authorize: () => ({ status: 401 }),
  },
}));
import { action } from "./api.kds.orders";

function patch(body: unknown) {
  return action({
    request: new Request("http://localhost/api/kds/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.bearer.mockResolvedValue({ user: { id: "operator" } });
  mocks.getOrder.mockResolvedValue({
    id: "order-id",
    commandNumber: 123,
    status: "assando",
    requestedForOven: false,
    DeliveryZone: null,
  });
});

it("passes both changes through the authenticated status endpoint and returns the updated order", async () => {
  const response = await patch({
    id: "order-id",
    status: "assando",
    fulfillOvenRequest: true,
  });
  expect(response.status).toBe(200);
  expect(mocks.setStatus).toHaveBeenCalledWith("order-id", "assando", {
    fulfillOvenRequest: true,
  });
  expect(mocks.setOven).not.toHaveBeenCalled();
  expect((await response.json()).order).toMatchObject({
    status: "assando",
    requestedForOven: false,
  });
});

it.each([
  { status: "finalizado", fulfillOvenRequest: true },
  { status: "assando", fulfillOvenRequest: "true" },
  { status: "assando", fulfillOvenRequest: null },
])("rejects invalid combinations without writing: %s", async (body) => {
  expect((await patch({ id: "order-id", ...body })).status).toBe(400);
  expect(mocks.setStatus).not.toHaveBeenCalled();
});

it("keeps existing status requests valid without requiring the new option", async () => {
  expect((await patch({ id: "order-id", status: "emProducao" })).status).toBe(
    200
  );
  expect(mocks.setStatus).toHaveBeenCalledWith("order-id", "emProducao", {
    fulfillOvenRequest: false,
  });
});

it("rejects unauthenticated requests before writing", async () => {
  mocks.bearer.mockResolvedValue({ user: null });
  expect(
    (
      await patch({
        id: "order-id",
        status: "assando",
        fulfillOvenRequest: true,
      })
    ).status
  ).toBe(401);
  expect(mocks.setStatus).not.toHaveBeenCalled();
});

it.each([true, false])(
  "persists the cut flag independently of status: %s",
  async (requiresCut) => {
    mocks.setCut.mockResolvedValue({ id: "order-id", requiresCut });
    const response = await patch({
      id: "order-id",
      action: "setRequiresCut",
      requiresCut,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, requiresCut });
    expect(mocks.setCut).toHaveBeenCalledWith("order-id", requiresCut);
    expect(mocks.setStatus).not.toHaveBeenCalled();
  }
);
it.each(["true", null, undefined, 1])(
  "rejects invalid cut flags before writing: %s",
  async (requiresCut) => {
    expect(
      (await patch({ id: "order-id", action: "setRequiresCut", requiresCut }))
        .status
    ).toBe(400);
    expect(mocks.setCut).not.toHaveBeenCalled();
  }
);
it("rejects cut changes for missing orders", async () => {
  mocks.getOrder.mockResolvedValue(null);
  expect(
    (
      await patch({
        id: "missing",
        action: "setRequiresCut",
        requiresCut: true,
      })
    ).status
  ).toBe(404);
  expect(mocks.setCut).not.toHaveBeenCalled();
});
it("requires authentication for cut changes", async () => {
  mocks.bearer.mockResolvedValue({ user: null });
  expect(
    (
      await patch({
        id: "order-id",
        action: "setRequiresCut",
        requiresCut: true,
      })
    ).status
  ).toBe(401);
  expect(mocks.setCut).not.toHaveBeenCalled();
});
it.each(["assando", "finalizado"])(
  "keeps the cut instruction in the updated order at %s",
  async (status) => {
    mocks.getOrder.mockResolvedValue({
      id: "order-id",
      commandNumber: 123,
      status,
      requiresCut: true,
      DeliveryZone: null,
    });
    const response = await patch({ id: "order-id", status });
    expect((await response.json()).order.requiresCut).toBe(true);
  }
);
