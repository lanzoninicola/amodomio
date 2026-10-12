import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  auth: vi.fn(),
  limit: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@config/env", () => ({ env: { apiRateLimitPerMinute: 60 } }));
vi.mock("~/domain/z-api/zapi.service.server", () => ({
  sendTextMessage: mocks.send,
}));
vi.mock("~/domain/z-api/message-tracking.server", () => ({
  getTrackedMessage: mocks.status,
}));
vi.mock("~/domain/z-api/route-helpers.server", () => ({
  enforceApiKey: mocks.auth,
  enforceRateLimit: mocks.limit,
  handleRouteError: (error: any) =>
    new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
    }),
}));
import { action } from "./api.messages.text";
import { loader } from "./api.messages.status.$trackingId";
const args = (method = "POST") =>
  ({
    request: new Request("https://app.test/api/messages/text", {
      method,
      ...(method === "POST"
        ? { body: JSON.stringify({ phone: "5511999999999", message: "Olá" }) }
        : {}),
    }),
    params: { trackingId: "tracking" },
    context: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(null);
  mocks.limit.mockReturnValue(null);
});
it("returns 202 and a status URL, without claiming delivery", async () => {
  mocks.send.mockResolvedValue({
    trackingId: "tracking",
    status: "accepted",
    confirmed: false,
    messageId: "msg",
  });
  const result = await action(args());
  expect(result.status).toBe(202);
  expect(await result.json()).toMatchObject({
    confirmed: false,
    status: "accepted",
    statusUrl: "/api/messages/status/tracking",
  });
  expect(mocks.send).toHaveBeenCalledWith(
    { phone: "5511999999999", message: "Olá" },
    { crmSource: "api.messages.text" }
  );
});
it("blocks invalid credentials before sending or looking up message status", async () => {
  mocks.auth.mockReturnValue(new Response(null, { status: 401 }));
  expect((await action(args())).status).toBe(401);
  expect((await loader(args("GET"))).status).toBe(401);
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.status).not.toHaveBeenCalled();
});
it("propagates disconnection failure and provides an uncached status lookup", async () => {
  mocks.send.mockRejectedValue({
    message: "Instância desconectada",
    status: 503,
  });
  expect((await action(args())).status).toBe(503);
  mocks.status.mockResolvedValue({
    trackingId: "tracking",
    status: "delivered",
    confirmed: true,
  });
  const result = await loader(args("GET"));
  expect(await result.json()).toMatchObject({
    status: "delivered",
    confirmed: true,
  });
  expect(result.headers.get("cache-control")).toBe("no-store");
});
