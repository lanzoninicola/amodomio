import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  setStatus: vi.fn(),
  setOven: vi.fn(),
  bearer: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({ default: {} }));
vi.mock("~/domain/kds/server", () => ({
  getOrderForApiById: mocks.getOrder,
  setOrderStatus: mocks.setStatus,
  setOrderRequestedForOven: mocks.setOven,
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
