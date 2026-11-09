import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  setting: vi.fn(),
  order: vi.fn(),
  send: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.auth,
}));
vi.mock("~/domain/kds/whatsapp-settings.server", () => ({
  ensureKdsWhatsappSetting: mocks.setting,
}));
vi.mock("~/domain/kds/server", () => ({ getOrderForApiById: mocks.order }));
vi.mock("~/domain/z-api/zapi.service.server", () => ({
  sendTextMessage: mocks.send,
}));
vi.mock("~/domain/z-api/route-helpers.server", () => ({
  enforceRateLimit: mocks.limit,
  handleRouteError: () => new Response(null, { status: 502 }),
}));
import { action, loader } from "./api.kds.whatsapp";
const args = (
  body = { orderId: "order-1", message: "Pedido pronto", phone: "untrusted" }
) =>
  ({
    request: new Request("https://kds.test/api/kds/whatsapp", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { roles: ["kdsOperator"] } });
  mocks.setting.mockResolvedValue({ value: "true" });
  mocks.order.mockResolvedValue({ customerPhone: "5546999999999" });
  mocks.limit.mockReturnValue(null);
  mocks.send.mockResolvedValue({});
});
it("requires a valid session and a kitchen role", async () => {
  mocks.auth.mockResolvedValue({ user: null });
  expect((await action(args())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { roles: ["user"] } });
  expect((await action(args())).status).toBe(403);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("enforces the server setting even for direct requests", async () => {
  mocks.setting.mockResolvedValue({ value: "false" });
  expect((await action(args())).status).toBe(403);
  expect(mocks.send).not.toHaveBeenCalled();
  expect(await (await loader(args())).json()).toEqual({ enabled: false });
});
it("sends only to the phone stored on the order", async () => {
  expect((await action(args())).status).toBe(200);
  expect(mocks.send).toHaveBeenCalledWith({
    phone: "5546999999999",
    message: "Pedido pronto",
  });
});
it("rejects missing orders and missing phones", async () => {
  mocks.order.mockResolvedValue(null);
  expect((await action(args())).status).toBe(404);
  mocks.order.mockResolvedValue({ customerPhone: " " });
  expect((await action(args())).status).toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("rejects empty messages and respects rate limits", async () => {
  expect(
    (await action(args({ orderId: "order-1", message: " ", phone: "" }))).status
  ).toBe(400);
  mocks.limit.mockReturnValue(new Response(null, { status: 429 }));
  expect((await action(args())).status).toBe(429);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("does not report success when the provider fails", async () => {
  mocks.send.mockRejectedValue(new Error("provider unavailable"));
  expect((await action(args())).status).toBe(502);
});
