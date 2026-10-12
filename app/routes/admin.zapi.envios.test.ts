import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  reconnect: vi.fn(),
  check: vi.fn(),
  qr: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/domain/z-api/reconnection.server", () => ({
  tryReconnectZapi: mocks.reconnect,
  checkZapiReconnection: mocks.check,
  getZapiPairingQrCode: mocks.qr,
}));
vi.mock("~/domain/z-api/message-tracking.server", () => ({
  listTrackedMessages: vi.fn(),
}));
vi.mock("~/domain/z-api/route-helpers.server", () => ({
  enforceRateLimit: mocks.limit,
}));
vi.mock("~/domain/z-api/zapi-client.server", async (original) => {
  const actual = await original<
    typeof import("~/domain/z-api/zapi-client.server")
  >();
  return { ...actual, getZapiConnection: vi.fn() };
});
vi.mock("@config/env", () => ({ env: {} }));
import { action } from "./admin.zapi.envios";
import { ZApiError } from "~/domain/z-api/zapi-client.server";
const args = (
  intent = "reconnect",
  origin = "https://app.test",
  method = "POST"
) =>
  ({
    request: new Request("https://app.test/admin/zapi/envios", {
      method,
      headers: { Origin: origin },
      ...(method === "POST"
        ? { body: new URLSearchParams({ _intent: intent }) }
        : {}),
    }),
    context: {},
    params: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ roles: ["admin"] });
  mocks.limit.mockReturnValue(null);
  mocks.reconnect.mockResolvedValue({
    state: "connected",
    message: "Conectado",
  });
});
it("protects restart from unauthenticated and non-admin requests", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await action(args())).status).toBe(401);
  mocks.auth.mockResolvedValueOnce({ roles: ["kdsOperator"] });
  expect((await action(args())).status).toBe(403);
  expect(mocks.reconnect).not.toHaveBeenCalled();
});
it("rejects cross-origin requests, GETs and unknown intents", async () => {
  expect((await action(args("reconnect", "https://other.test"))).status).toBe(
    403
  );
  expect(
    (await action(args("reconnect", "https://app.test", "GET"))).status
  ).toBe(405);
  expect((await action(args("disconnect"))).status).toBe(400);
  expect(mocks.reconnect).not.toHaveBeenCalled();
});
it("restarts only for an explicit authenticated POST", async () => {
  const response = await action(args());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ state: "connected" });
  expect(mocks.reconnect).toHaveBeenCalledTimes(1);
});
it("does not restart when checking connection or refreshing QR", async () => {
  mocks.check.mockResolvedValue({ state: "disconnected" });
  mocks.qr.mockResolvedValue({ state: "qr" });
  await action(args("connection"));
  await action(args("qr-code"));
  expect(mocks.reconnect).not.toHaveBeenCalled();
  expect(mocks.check).toHaveBeenCalledTimes(1);
  expect(mocks.qr).toHaveBeenCalledTimes(1);
});
it("honors the restart cooldown", async () => {
  mocks.limit.mockReturnValue(
    new Response(null, { status: 429, headers: { "Retry-After": "45" } })
  );
  const response = await action(args());
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("45");
  expect(mocks.reconnect).not.toHaveBeenCalled();
});
it("does not expose provider error payloads or credentials", async () => {
  mocks.reconnect.mockRejectedValue(
    new ZApiError(
      "token=private",
      500,
      { token: "private" },
      "/instances/instance/token/private/restart"
    )
  );
  const response = await action(args());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private");
});
