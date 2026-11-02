import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.session,
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { adminActionNotification: mocks },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { rateLimitCheck: mocks.rate },
}));
import { action, loader } from "./api.kds.messages";
const id = "adfe2496-00f9-4368-8372-e9d8e9dbd114";
const post = (body: unknown) =>
  action({
    request: new Request("http://localhost/api/kds/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { roles: ["kdsOperator"] } });
  mocks.rate.mockReturnValue({ success: true });
  mocks.findMany.mockResolvedValue([]);
});
it("requires authentication and KDS access", async () => {
  mocks.session.mockResolvedValue({ user: null });
  expect((await post({ intent: "send", id, text: "aviso" })).status).toBe(401);
  mocks.session.mockResolvedValue({ user: { roles: ["user"] } });
  expect((await post({ intent: "send", id, text: "aviso" })).status).toBe(403);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("validates empty, oversized and malformed messages", async () => {
  for (const body of [
    null,
    {},
    { intent: "send", id, text: "  " },
    { intent: "send", id, text: "a".repeat(501) },
  ])
    expect((await post(body)).status).toBe(400);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("stores a trimmed message and uses the same key for retries", async () => {
  for (let i = 0; i < 2; i++)
    expect(
      (await post({ intent: "send", id, text: "  Sem cebola  " })).status
    ).toBe(200);
  expect(mocks.upsert).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: { key: `kds-kitchen-message:${id}` },
      update: {},
      create: expect.objectContaining({
        description: "Sem cebola",
        status: "kds-pending",
      }),
    })
  );
});
it("acknowledges only kitchen messages without changing orders", async () => {
  expect((await post({ intent: "acknowledge", id })).status).toBe(200);
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id, type: "kds-kitchen-message", status: "kds-pending" },
    data: { status: "resolved", resolvedAt: expect.any(Date) },
  });
});
it("lists only recent pending kitchen messages without caching", async () => {
  const response = await loader({
    request: new Request("http://localhost/api/kds/messages"),
  } as any);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        type: "kds-kitchen-message",
        status: "kds-pending",
        createdAt: { gte: expect.any(Date) },
      },
      take: 50,
    })
  );
});
it("limits sends", async () => {
  mocks.rate.mockReturnValue({ success: false });
  expect((await post({ intent: "send", id, text: "aviso" })).status).toBe(429);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
