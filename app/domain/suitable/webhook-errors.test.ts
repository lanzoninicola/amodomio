import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
const { create, sync } = vi.hoisted(() => ({ create: vi.fn(), sync: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({ default: { suitableWebhookEvent: { create } } }));
vi.mock("~/domain/suitable/suitable-inbox.server", () => ({ syncInboxOrder: sync }));
import { action } from "../../routes/webhooks.suitable";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); create.mockReset(); sync.mockReset(); });
async function deliver(body: unknown) {
  vi.stubEnv("SUITABLE_WEBHOOK_SECRET", "test-secret");
  const raw = JSON.stringify(body);
  const request = new Request("https://example.com/webhooks/suitable", {
    method: "POST", body: raw,
    headers: { "x-app-signature": createHmac("sha256", "test-secret").update(raw).digest("hex") },
  });
  return action({ request } as any);
}
const event = { id: "event-1", type: "new_order", data: { order_id: 123 } };

it("returns 503 for database failures instead of acknowledging a duplicate", async () => {
  create.mockRejectedValue({ code: "P1001" });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = await deliver(event);
  expect(result.status).toBe(503);
  expect(await result.text()).toContain("event_persistence_failed");
  expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ eventId: "event-1", orderId: 123, databaseCode: "P1001" }));
  expect(sync).not.toHaveBeenCalled();
});
it("acknowledges unique constraint duplicates", async () => {
  create.mockRejectedValue({ code: "P2002" });
  expect(await (await deliver(event)).text()).toBe("duplicate");
  expect(sync).not.toHaveBeenCalled();
});
it("rejects null JSON with a diagnostic rather than throwing", async () => {
  expect((await deliver(null)).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("validates order ID before recording the event", async () => {
  expect((await deliver({ ...event, data: { order_id: 0 } })).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("registers background work with waitUntil and bounds the API deadline", async () => {
  create.mockResolvedValue({});
  sync.mockResolvedValue({ ok: true });
  const background: Promise<unknown>[] = [];
  const context = { waitUntil: (promise: Promise<unknown>) => { background.push(promise); } };
  const symbol = Symbol.for("@vercel/request-context");
  vi.stubGlobal(symbol as any, { get: () => context });
  try {
    expect((await deliver(event)).status).toBe(200);
    expect(background).toHaveLength(1);
    await Promise.all(background);
    expect(sync).toHaveBeenCalledWith(123, "event-1", "new_order", { signal: expect.any(AbortSignal) });
  } finally { vi.unstubAllGlobals(); }
});
