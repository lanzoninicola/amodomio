export const SIZES = [
  { key: "family", label: "Família", grams: 1250 },
  { key: "medium", label: "Média", grams: 400 },
  { key: "individual", label: "Individual", grams: 240 },
  { key: "small", label: "Pequena", grams: 140 },
] as const;
export type SizeKey = (typeof SIZES)[number]["key"];
export const FIELDS = [
  "previous",
  "incoming",
  "todaySales",
  "tomorrowSales",
  "production",
  "laterSales",
  "laterProduction",
] as const;
export type Field = (typeof FIELDS)[number];
export type Row = Record<Field, string> & { grams: string };
export type Plan = Record<SizeKey, Row>;
export const CAPACITY_GRAMS = 22000;
export function integer(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(number)))
    : 0;
}
export function emptyPlan(): Plan {
  return Object.fromEntries(
    SIZES.map(({ key, grams }) => [
      key,
      {
        previous: "",
        incoming: "",
        todaySales: "",
        tomorrowSales: "",
        production: "",
        laterSales: "",
        laterProduction: "",
        grams: String(grams),
      },
    ])
  ) as Plan;
}
export function parsePlan(raw: string | null): Plan {
  const plan = emptyPlan();
  if (!raw) return plan;
  const saved = JSON.parse(raw);
  if (
    ![1, 2].includes(saved?.version) ||
    !saved.rows ||
    typeof saved.rows !== "object"
  )
    throw new Error("Formato de planejamento inválido");
  for (const { key } of SIZES) {
    for (const field of [...FIELDS, "grams"] as const) {
      const value = saved.rows[key]?.[field];
      if (
        typeof value === "string" &&
        /^\d*$/.test(value) &&
        (field !== "grams" || integer(value) > 0)
      )
        plan[key][field] =
          saved.version === 1 &&
          (field === "production" || field === "laterProduction") &&
          value === "0"
            ? ""
            : value;
    }
  }
  return plan;
}
export function productionQuantity(value: string, need: number): number {
  return value === "" ? need : integer(value);
}
export function calculateRow(row: Row) {
  const available = integer(row.previous) + integer(row.incoming);
  const balance = available - integer(row.todaySales);
  const needTomorrow = Math.max(integer(row.tomorrowSales) - balance, 0);
  const defined = productionQuantity(row.production, needTomorrow);
  const gramsTomorrow = integer(row.grams) * defined;
  const balanceTomorrow = defined + balance - integer(row.tomorrowSales);
  const needLater = Math.max(integer(row.laterSales) - balanceTomorrow, 0);
  return {
    available,
    balance,
    needTomorrow,
    gramsTomorrow,
    balanceTomorrow,
    needLater,
    gramsLater:
      integer(row.grams) * productionQuantity(row.laterProduction, needLater),
  };
}
export function calculatePlan(plan: Plan) {
  const rows = SIZES.map(({ key }) => ({ key, ...calculateRow(plan[key]) }));
  const gramsTomorrow = rows.reduce((sum, row) => sum + row.gramsTomorrow, 0);
  const gramsLater = rows.reduce((sum, row) => sum + row.gramsLater, 0);
  return {
    rows,
    gramsTomorrow,
    gramsLater,
    overTomorrow: gramsTomorrow > CAPACITY_GRAMS,
    overLater: gramsLater > CAPACITY_GRAMS,
  };
}
export function parseReferenceDate(raw: string | null): string | null {
  if (!raw) return null;
  const value = JSON.parse(raw)?.referenceDate;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}
export function planningDays(now: Date | string = new Date()) {
  if (typeof now === "string") now = new Date(`${now}T12:00:00Z`);
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    Number(local.find((p) => p.type === name)?.value);
  const base = Date.UTC(part("year"), part("month") - 1, part("day"), 12);
  return [-1, 0, 1, 2].map((offset) => {
    const date = new Date(base + offset * 86400000);
    return {
      key: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        timeZone: "America/Sao_Paulo",
      })
        .format(date)
        .replace("-feira", "")
        .toUpperCase(),
      date: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(date),
    };
  });
}

export function productionShortfallLevel(value: string, need: number): number {
  if (value.trim() === "" || need <= 0) return 0;
  const deficit = (need - integer(value)) / need;
  if (deficit <= 0) return 0;
  if (deficit <= 0.1) return 1;
  if (deficit <= 0.25) return 2;
  if (deficit <= 0.5) return 3;
  if (deficit <= 0.75) return 4;
  return 5;
}
