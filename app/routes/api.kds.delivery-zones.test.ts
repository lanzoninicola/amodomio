import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { deliveryZone: { findFirst: mocks.find, create: mocks.create } },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { authorize: mocks.auth, rateLimitCheck: mocks.limit },
}));
import { action } from "./api.kds.delivery-zones";
const zone = { name: "Cidade Industrial", city: "Pato Branco", state: "PR" };
async function post(body: unknown = zone) {
  const response = await action({
    request: new Request("https://kds.test/api/kds/delivery-zones", {
      method: "POST",
      headers: { "x-api-key": "test" },
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  } as any);
  return { status: response.status, body: await response.json() };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue({ status: 200 });
  mocks.limit.mockReturnValue({ success: true });
  mocks.find.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ ...zone, id: "new" });
});
it("creates a zone with trimmed fields and normalized UF", async () => {
  const result = await post({
    ...zone,
    name: " Cidade Industrial ",
    state: "pr",
  });
  expect(result.status).toBe(201);
  expect(result.body.zone.id).toBe("new");
  expect(mocks.create).toHaveBeenCalledWith({ data: zone });
});
it("reuses an existing zone in the same city and state", async () => {
  mocks.find.mockResolvedValue({ ...zone, id: "existing" });
  expect((await post()).body.zone.id).toBe("existing");
  expect(mocks.find).toHaveBeenCalledWith({
    where: {
      name: { equals: zone.name, mode: "insensitive" },
      city: { equals: zone.city, mode: "insensitive" },
      state: { equals: zone.state, mode: "insensitive" },
    },
  });
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each([{}, { ...zone, state: "XX" }, { ...zone, city: "" }, null])(
  "rejects invalid fields: %j",
  async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  }
);
it("rejects unauthorized creation before database access", async () => {
  mocks.auth.mockReturnValue({ status: 401 });
  expect((await post()).status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled();
});
it("enforces the rate limit", async () => {
  mocks.limit.mockReturnValue({ success: false });
  expect((await post()).status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
});
