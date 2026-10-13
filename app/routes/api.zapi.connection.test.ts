import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connection: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/domain/z-api/zapi-client.server", () => ({
  getZapiConnection: mocks.connection,
}));
vi.mock("~/domain/z-api/route-helpers.server", () => ({
  enforceRateLimit: mocks.limit,
}));
import { loader } from "./api.zapi.connection";
const args = () =>
  ({
    request: new Request("https://app.test/api/zapi/connection"),
    params: {},
    context: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ roles: ["user"] });
  mocks.limit.mockReturnValue(null);
});

it("requires authentication before contacting the provider", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await loader(args())).status).toBe(401);
  expect(mocks.connection).not.toHaveBeenCalled();
});
it.each([true, false])(
  "returns the actual connection state %s without credentials",
  async (connected) => {
    mocks.connection.mockResolvedValue({ connected, token: "private" });
    const result = await loader(args());
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    const data = await result.json();
    expect(data.connected).toBe(connected);
    expect(data.token).toBeUndefined();
  }
);
it("marks provider failures as unknown rather than disconnected", async () => {
  mocks.connection.mockRejectedValue(new Error("private provider details"));
  const result = await loader(args());
  expect(result.status).toBe(502);
  expect(await result.json()).toMatchObject({ connected: null });
});
it("respects the rate limiter", async () => {
  mocks.limit.mockReturnValue(new Response(null, { status: 429 }));
  expect((await loader(args())).status).toBe(429);
  expect(mocks.connection).not.toHaveBeenCalled();
});
