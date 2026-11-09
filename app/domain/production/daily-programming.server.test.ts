import { beforeEach, describe, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { $queryRaw: query },
}));
import {
  getDailyProgramming,
  loadWeeklyHistoryData,
} from "./daily-programming.server";

describe("daily programming", () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([]);
  });
  it("bounds invalid and oversized query parameters", async () => {
    const result = getDailyProgramming(
      new Request("https://example.test/?n=Infinity&pct=NaN")
    );
    expect(result.n).toBe(6);
    expect(result.pct).toBe(10);
    const stats = await result.stats;
    expect(stats.lastByDate).toHaveLength(6);
    expect(
      stats.perSize.every((row) => row.forecast === 0 && row.min === 0)
    ).toBe(true);
    const bounded = getDailyProgramming(
      new Request("https://example.test/?n=-2&pct=999")
    );
    expect(bounded.n).toBe(1);
    expect(bounded.pct).toBe(200);
    await bounded.stats;
  });
  it("uses recent weights, frequency, adjustment and excludes closed days", async () => {
    const request = new Request(
      "https://example.test/?weekday=segunda&n=3&pct=10"
    );
    const dates = getDailyProgramming(request).dateInts;
    query.mockResolvedValue([
      { dateInt: dates[1], f: 10, m: 4, i: 0, p: 0 },
      { dateInt: dates[2], f: 20, m: 0, i: 0, p: 0 },
    ]);
    const { stats } = getDailyProgramming(request);
    const result = await stats;
    expect(result.perSize[0]).toMatchObject({
      min: 10,
      max: 20,
      avg: 15,
      forecast: 18,
      freqPct: 100,
    });
    expect(result.perSize[1]).toMatchObject({
      avg: 2,
      forecast: 1,
      freqPct: 50,
    });
    expect(result.lastByDate[0].counts["Família"]).toBe(0);
  });
  it("includes zero-sale complete weeks in weekly totals", async () => {
    const result = await loadWeeklyHistoryData(
      new Request("https://example.test/?weeks=3")
    );
    expect(result.weeksCount).toBe(3);
    expect(result.weeklyBySize).toHaveLength(4);
    expect(
      result.weeklyBySize.every(
        (row) => row.total === 0 && row.min === 0 && row.max === 0
      )
    ).toBe(true);
  });
});
