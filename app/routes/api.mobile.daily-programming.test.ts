import { describe, expect, it, vi, beforeEach } from "vitest";
const { auth, daily, weekly } = vi.hoisted(() => ({
  auth: vi.fn(),
  daily: vi.fn(),
  weekly: vi.fn(),
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: auth,
}));
vi.mock("~/domain/production/daily-programming.server", () => ({
  getDailyProgramming: daily,
  loadWeeklyHistoryData: weekly,
}));
import { loader } from "./api.mobile.daily-programming";
const load = (query = "") =>
  loader({
    request: new Request(
      `https://example.test/api/mobile/daily-programming${query}`
    ),
    params: {},
    context: {},
  });
describe("mobile daily programming API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("requires authentication before loading production data", async () => {
    auth.mockResolvedValue({ user: null });
    expect((await load()).status).toBe(401);
    expect(daily).not.toHaveBeenCalled();
    expect(weekly).not.toHaveBeenCalled();
  });
  it("resolves statistics before serializing and prevents caching", async () => {
    auth.mockResolvedValue({ user: { id: "user" } });
    daily.mockReturnValue({
      weekday: "domingo",
      pct: 10,
      n: 6,
      stats: Promise.resolve({ perSize: [] }),
    });
    const response = await load();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ stats: { perSize: [] } });
  });
  it("returns weekly history when requested", async () => {
    auth.mockResolvedValue({ user: { id: "user" } });
    weekly.mockResolvedValue({ weeksCount: 3, weeklyBySize: [] });
    expect(await (await load("?weeklyHistory=1")).json()).toEqual({
      weeksCount: 3,
      weeklyBySize: [],
    });
    expect(daily).not.toHaveBeenCalled();
  });
});
