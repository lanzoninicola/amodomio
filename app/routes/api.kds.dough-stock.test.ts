import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sizes: vi.fn(),
  stock: vi.fn(),
  previous: vi.fn(),
  save: vi.fn(),
  notify: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.auth,
}));
vi.mock("~/domain/kds/dough-stock.server", () => ({
  getAvailableDoughSizes: mocks.sizes,
  getDoughStock: mocks.stock,
  getPreviousDoughStock: mocks.previous,
  saveDoughStock: mocks.save,
  notifyTodayDoughStockSavedByWhatsapp: mocks.notify,
}));
vi.mock("~/domain/kds/utils/date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/domain/kds/utils/date")>()),
  todayLocalYMD: () => "2026-10-12",
}));
vi.mock("~/domain/z-api/route-helpers.server", () => ({
  enforceRateLimit: mocks.limit,
  handleRouteError: () => new Response(null, { status: 500 }),
}));
import { action, loader } from "./api.kds.dough-stock";
const counts = { F: 10, M: 20, P: 30, I: 40, FT: 7 };
const args = (body?: unknown, date = "2026-10-12") => ({
  request: new Request(
    `https://app.test/api/kds/dough-stock?date=${date}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
  ),
  params: {},
  context: {},
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { roles: ["kdsAdmin"] } });
  mocks.sizes.mockResolvedValue([]);
  mocks.stock.mockResolvedValue(null);
  mocks.previous.mockResolvedValue(null);
  mocks.save.mockResolvedValue({ effective: counts });
  mocks.limit.mockReturnValue(null);
});
it("rejects unauthenticated reads and writes before database access", async () => {
  mocks.auth.mockResolvedValue({ user: null });
  expect((await loader(args())).status).toBe(401);
  expect(
    (await action(args({ date: "2026-10-12", intent: "save", counts }))).status
  ).toBe(401);
  expect(mocks.stock).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects profiles without kitchen access", async () => {
  mocks.auth.mockResolvedValue({ user: { roles: ["user"] } });
  expect((await loader(args())).status).toBe(403);
  expect(
    (await action(args({ date: "2026-10-12", intent: "reset" }))).status
  ).toBe(403);
});
it("loads the selected day and previous stock without caching", async () => {
  const result = await loader(args());
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(await result.json()).toMatchObject({
    date: "2026-10-12",
    today: "2026-10-12",
  });
  expect(mocks.stock).toHaveBeenCalledWith(20261012);
  expect(mocks.previous).toHaveBeenCalledWith(20261012);
});
it("saves the override balance including the hidden Fatia quantity", async () => {
  expect(
    (await action(args({ date: "2026-10-12", intent: "save", counts }))).status
  ).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(
    20261012,
    new Date("2026-10-12T12:00:00.000Z"),
    counts,
    counts
  );
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("resets all sizes", async () => {
  await action(args({ date: "2026-10-12", intent: "reset", counts }));
  const zero = { F: 0, M: 0, P: 0, I: 0, FT: 0 };
  expect(mocks.save).toHaveBeenCalledWith(
    20261012,
    expect.any(Date),
    zero,
    zero
  );
});
it.each([-1, 0.5, "10", null, 1e30])(
  "rejects invalid quantities %s",
  async (value) => {
    expect(
      (
        await action(
          args({
            date: "2026-10-12",
            intent: "save",
            counts: { ...counts, F: value },
          })
        )
      ).status
    ).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  }
);
it("rejects impossible dates and unknown operations", async () => {
  expect((await loader(args(undefined, "2026-02-30"))).status).toBe(400);
  expect(
    (await action(args({ date: "2026-10-12", intent: "delete", counts })))
      .status
  ).toBe(400);
});
it("sends today's draft without saving it", async () => {
  mocks.notify.mockResolvedValue({
    ok: true,
    attempted: true,
    skipped: false,
    detail: "Enviado",
  });
  const response = await action(
    args({ date: "2026-10-12", intent: "sendWhatsapp", counts })
  );
  expect(await response.json()).toMatchObject({ ok: true, whatsappSent: true });
  expect(mocks.notify).toHaveBeenCalledWith({
    dateStr: "2026-10-12",
    snapshot: expect.objectContaining({ effective: counts }),
  });
  expect(mocks.save).not.toHaveBeenCalled();
});
it("prevents sending historical stock", async () => {
  expect(
    (await action(args({ date: "2026-10-11", intent: "sendWhatsapp", counts })))
      .status
  ).toBe(400);
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("limits WhatsApp sends", async () => {
  mocks.limit.mockReturnValue(new Response(null, { status: 429 }));
  expect(
    (await action(args({ date: "2026-10-12", intent: "sendWhatsapp", counts })))
      .status
  ).toBe(429);
  expect(mocks.notify).not.toHaveBeenCalled();
});
