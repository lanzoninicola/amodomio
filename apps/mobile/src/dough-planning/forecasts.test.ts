import { describe, expect, it, vi } from "vitest";
import { emptyPlan, planningDays } from "./calculation";
import {
  applyForecasts,
  forecastWeekday,
  hasForecast,
  initialForecastDocument,
  loadForecasts,
  mapForecast,
  parseForecastDocument,
  restoreAutomatic,
} from "./forecasts";
import type { DailyProgramming } from "../production/types";
const response = (factor = 1): DailyProgramming => ({
  weekday: "domingo",
  pct: 10,
  n: 6,
  stats: {
    sizes: ["Família", "Médio", "Individual", "Pequena"],
    lastByDate: [],
    perSize: ["Família", "Médio", "Individual", "Pequena"].map(
      (size, index) => ({
        size,
        forecast: (index + 1) * factor,
        min: 0,
        max: 30,
        avg: 10,
        freqDays: 6,
        freqPct: 100,
      })
    ),
  },
});
const dates = planningDays("2026-11-01")
  .slice(1)
  .map((day) => day.key);
describe("previsões automáticas de planejamento", () => {
  it("mapeia os tamanhos sem trocar Individual e Pequena e aceita Médio/Média", () => {
    expect(mapForecast(response(3))).toEqual({
      family: "3",
      medium: "6",
      individual: "9",
      small: "12",
    });
    const data = response();
    data.stats.perSize[1].size = "Média";
    expect(mapForecast(data).medium).toBe("2");
  });
  it("não transforma tamanhos ausentes ou números inválidos em previsão zero", () => {
    const incomplete = response();
    incomplete.stats.perSize.pop();
    expect(() => mapForecast(incomplete)).toThrow();
    const invalid = response();
    invalid.stats.perSize[0].forecast = NaN;
    expect(() => mapForecast(invalid)).toThrow();
    invalid.stats.perSize[0].forecast = -1;
    expect(() => mapForecast(invalid)).toThrow();
  });
  it("carrega os três dias em paralelo usando os dias corretos na virada do mês", async () => {
    const period = planningDays("2026-10-31")
      .slice(1)
      .map((day) => day.key);
    const releases: ((value: DailyProgramming) => void)[] = [];
    const fetchDay = vi.fn(
      (_weekday: string, _signal: AbortSignal) =>
        new Promise<DailyProgramming>((resolve) => releases.push(resolve))
    );
    const controller = new AbortController();
    const pending = loadForecasts(period, fetchDay, controller.signal);
    expect(fetchDay.mock.calls.map(([weekday]) => weekday)).toEqual([
      "sabado",
      "domingo",
      "segunda",
    ]);
    for (let index = 0; index < 3; index++) {
      expect(fetchDay.mock.calls[index][1]).toBe(controller.signal);
      releases[index](response(index + 1));
    }
    const result = await pending;
    expect(Object.keys(result.errors)).toHaveLength(0);
    expect(result.cache["2026-11-01"].values.family).toBe("2");
    expect(forecastWeekday("2026-11-03")).toBe("terca");
  });
  it("preserva falhas por data e mantém os resultados válidos sem inventar zeros", async () => {
    const failure = new Error("Sem conexão");
    const result = await loadForecasts(
      dates,
      async (day) => {
        if (day === "segunda") throw failure;
        return response();
      },
      new AbortController().signal
    );
    expect(result.errors[dates[1]]).toBe(failure);
    expect(result.cache[dates[1]]).toBeUndefined();
    expect(Object.keys(result.cache)).toHaveLength(2);
    const document = { version: 1 as const, cache: result.cache, manual: {} };
    expect(hasForecast(document, dates[1])).toBe(false);
    expect(
      applyForecasts(emptyPlan(), dates, document).family.tomorrowSales
    ).toBe("");
  });
  it("mantém ajustes manuais na data real ao avançar, voltar e trocar de semana", async () => {
    const raw = emptyPlan();
    raw.family.todaySales = "17";
    raw.family.production = "12";
    raw.family.previous = "4";
    const doc = initialForecastDocument(raw, dates);
    const loaded = await loadForecasts(
      dates,
      async () => response(5),
      new AbortController().signal
    );
    doc.cache = loaded.cache;
    expect(applyForecasts(raw, dates, doc).family).toMatchObject({
      todaySales: "17",
      tomorrowSales: "5",
      laterSales: "5",
      production: "12",
      previous: "4",
    });
    const previousDates = planningDays("2026-10-31")
      .slice(1)
      .map((day) => day.key);
    expect(applyForecasts(raw, previousDates, doc).family.tomorrowSales).toBe(
      "17"
    );
    const nextWeek = planningDays("2026-11-08")
      .slice(1)
      .map((day) => day.key);
    expect(applyForecasts(raw, nextWeek, doc).family.todaySales).toBe("");
    expect(applyForecasts(raw, dates, doc).family.todaySales).toBe("17");
    expect(raw.family.tomorrowSales).toBe("");
  });
  it("restaura previsões automáticas só nas datas visíveis e preserva produção e pesos", async () => {
    const plan = emptyPlan();
    plan.small.todaySales = "0";
    plan.small.grams = "150";
    plan.small.production = "10";
    const doc = initialForecastDocument(plan, dates);
    doc.manual["2026-10-30"] = { small: "21" };
    doc.cache = (
      await loadForecasts(
        dates,
        async () => response(2),
        new AbortController().signal
      )
    ).cache;
    const reset = restoreAutomatic(doc, dates);
    expect(applyForecasts(plan, dates, reset).small).toMatchObject({
      todaySales: "8",
      grams: "150",
      production: "10",
    });
    expect(reset.manual["2026-10-30"].small).toBe("21");
    expect(doc.manual[dates[0]].small).toBe("0");
  });
  it("persiste cache e ajustes, inclusive zero e vazio manuais", async () => {
    const doc = initialForecastDocument(emptyPlan(), dates);
    doc.manual[dates[0]] = { family: "0", medium: "" };
    doc.cache = (
      await loadForecasts(
        dates,
        async () => response(4),
        new AbortController().signal
      )
    ).cache;
    const restored = parseForecastDocument(JSON.stringify(doc));
    expect(restored).toEqual(doc);
    expect(hasForecast(restored, dates[0])).toBe(true);
    expect(applyForecasts(emptyPlan(), dates, restored).family.todaySales).toBe(
      "0"
    );
    expect(applyForecasts(emptyPlan(), dates, restored).medium.todaySales).toBe(
      ""
    );
    expect(() => parseForecastDocument("null")).toThrow();
    expect(() => forecastWeekday("2026-02-30")).toThrow();
  });
});
