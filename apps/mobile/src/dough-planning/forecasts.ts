import { SIZES, type Plan, type SizeKey } from "./calculation";
import type { DailyProgramming } from "../production/types";

export const FORECAST_OPTIONS = { pct: 10, n: 6 } as const;
export const SALES_FIELDS = [
  "todaySales",
  "tomorrowSales",
  "laterSales",
] as const;
export type SalesField = (typeof SALES_FIELDS)[number];
export type ForecastValues = Record<SizeKey, string>;
export type ForecastDocument = {
  version: 1;
  cache: Record<string, { values: ForecastValues; updatedAt: string }>;
  manual: Record<string, Partial<ForecastValues>>;
};
const WEEKDAYS = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];
export function forecastWeekday(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error("Data de previsão inválida.");
  return WEEKDAYS[parsed.getUTCDay()];
}
export function mapForecast(data: DailyProgramming): ForecastValues {
  const aliases: Record<string, SizeKey> = {
    familia: "family",
    medio: "medium",
    media: "medium",
    individual: "individual",
    pequena: "small",
  };
  const values: Partial<ForecastValues> = {};
  if (!Array.isArray(data?.stats?.perSize))
    throw new Error("Previsão recebida em formato inválido.");
  for (const row of data.stats.perSize) {
    const key =
      aliases[
        row.size
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      ];
    if (!key) continue;
    if (
      !Number.isSafeInteger(row.forecast) ||
      row.forecast < 0 ||
      row.forecast > 9999999 ||
      values[key] !== undefined
    )
      throw new Error("Quantidade de previsão inválida.");
    values[key] = String(row.forecast);
  }
  if (SIZES.some(({ key }) => values[key] === undefined))
    throw new Error("A previsão não contém todos os tamanhos.");
  return values as ForecastValues;
}
export function initialForecastDocument(
  plan: Plan,
  dates: string[]
): ForecastDocument {
  const manual: ForecastDocument["manual"] = {};
  dates.forEach((date, index) => {
    const field = SALES_FIELDS[index];
    for (const { key } of SIZES) {
      if (plan[key][field] !== "")
        (manual[date] ??= {})[key] = plan[key][field];
    }
  });
  return { version: 1, cache: {}, manual };
}
export function parseForecastDocument(raw: string): ForecastDocument {
  const data = JSON.parse(raw);
  if (
    data?.version !== 1 ||
    !data.cache ||
    !data.manual ||
    typeof data.cache !== "object" ||
    typeof data.manual !== "object"
  )
    throw new Error("Não foi possível recuperar as previsões salvas.");
  const result: ForecastDocument = { version: 1, cache: {}, manual: {} };
  const validValue = (value: unknown) =>
    typeof value === "string" && /^\d{0,7}$/.test(value);
  for (const [date, entry] of Object.entries(data.cache)) {
    forecastWeekday(date);
    const cached = entry as ForecastDocument["cache"][string];
    if (
      !cached?.values ||
      typeof cached.updatedAt !== "string" ||
      SIZES.some(
        ({ key }) =>
          !validValue(cached.values[key]) || cached.values[key] === ""
      )
    )
      throw new Error("Previsão salva inválida.");
    result.cache[date] = {
      values: Object.fromEntries(
        SIZES.map(({ key }) => [key, cached.values[key]])
      ) as ForecastValues,
      updatedAt: cached.updatedAt,
    };
  }
  for (const [date, entry] of Object.entries(data.manual)) {
    forecastWeekday(date);
    if (!entry || typeof entry !== "object")
      throw new Error("Ajuste salvo inválido.");
    result.manual[date] = {};
    for (const { key } of SIZES) {
      const value = (entry as Partial<ForecastValues>)[key];
      if (value !== undefined) {
        if (!validValue(value)) throw new Error("Ajuste salvo inválido.");
        result.manual[date][key] = value;
      }
    }
  }
  return result;
}
export function applyForecasts(
  plan: Plan,
  dates: string[],
  document: ForecastDocument
): Plan {
  return Object.fromEntries(
    SIZES.map(({ key }) => {
      const row = { ...plan[key] };
      dates.forEach((date, index) => {
        row[SALES_FIELDS[index]] =
          document.manual[date]?.[key] ??
          document.cache[date]?.values[key] ??
          "";
      });
      return [key, row];
    })
  ) as Plan;
}
export function hasForecast(document: ForecastDocument, date: string) {
  return SIZES.every(
    ({ key }) =>
      document.manual[date]?.[key] !== undefined ||
      document.cache[date]?.values[key] !== undefined
  );
}
export function isSalesField(field: string): field is SalesField {
  return SALES_FIELDS.includes(field as SalesField);
}
export function restoreAutomatic(
  document: ForecastDocument,
  dates: string[]
): ForecastDocument {
  const manual = { ...document.manual };
  for (const date of dates) delete manual[date];
  return { ...document, manual };
}
export async function loadForecasts(
  dates: string[],
  fetchDay: (weekday: string, signal: AbortSignal) => Promise<DailyProgramming>,
  signal: AbortSignal
) {
  const results = await Promise.allSettled(
    dates.map(async (date) => ({
      date,
      values: mapForecast(await fetchDay(forecastWeekday(date), signal)),
    }))
  );
  const cache: ForecastDocument["cache"] = {};
  const errors: Record<string, unknown> = {};
  results.forEach((result, index) => {
    if (result.status === "fulfilled")
      cache[result.value.date] = {
        values: result.value.values,
        updatedAt: new Date().toISOString(),
      };
    else errors[dates[index]] = result.reason;
  });
  return { cache, errors };
}

export function resetForecastDate(
  document: ForecastDocument,
  date: string
): ForecastDocument {
  return {
    ...document,
    manual: {
      ...document.manual,
      [date]: Object.fromEntries(SIZES.map(({ key }) => [key, "0"])),
    },
  };
}
