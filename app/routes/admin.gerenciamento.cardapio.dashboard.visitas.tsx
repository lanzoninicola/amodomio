import { json, type LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Visitas do cardapio" },
  { name: "robots", content: "noindex" },
];

type MonthRange = {
  label: string;
  start: Date;
  end: Date;
};

type MonthOption = {
  value: string;
  label: string;
};

type RangeOption = {
  value: "total" | "3" | "6" | "12";
  label: string;
  months: number | null;
};

type HourCount = {
  hour: number;
  count: number;
};

type WeekdayCount = {
  day: number;
  count: number;
};

const resolveMonthRange = (monthParam: string | null): MonthRange => {
  const now = new Date();
  const base = monthParam ? new Date(`${monthParam}-01T00:00:00`) : now;
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return { label, start, end };
};

const resolvePreviousMonthRange = (current: MonthRange): MonthRange => {
  const prevStart = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
  const prevEnd = new Date(current.start.getFullYear(), current.start.getMonth(), 1);
  const label = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`;

  return { label, start: prevStart, end: prevEnd };
};

const buildMonthOptions = (base: MonthRange, total = 12): MonthOption[] => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return Array.from({ length: total }).map((_, index) => {
    const date = new Date(base.start.getFullYear(), base.start.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = formatter.format(date);
    return { value, label };
  });
};

const rangeOptions: RangeOption[] = [
  { value: "total", label: "Total acumulado", months: null },
  { value: "3", label: "Últimos 3 meses", months: 3 },
  { value: "6", label: "Últimos 6 meses", months: 6 },
  { value: "12", label: "Últimos 12 meses", months: 12 },
];

const resolveRange = (value: string | null) =>
  rangeOptions.find((option) => option.value === value) ?? rangeOptions[0];
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const currentMonth = resolveMonthRange(url.searchParams.get("month"));
  const previousMonth = resolvePreviousMonthRange(currentMonth);
  const monthOptions = buildMonthOptions(currentMonth, 12);
  const range = resolveRange(url.searchParams.get("range"));
  const rangeStart =
    range.months == null
      ? null
      : new Date(
          currentMonth.start.getFullYear(),
          currentMonth.start.getMonth() - (range.months - 1),
          1
        );
  const viewListFilter = { type: "view_list" };

  const [
    totalVisitsCurrent,
    totalVisitsPrevious,
    totalVisitsTotal,
    uniqueVisitorsCurrent,
    uniqueVisitorsPrevious,
    uniqueVisitorsTotal,
    uniqueVisitorsByHourRaw,
    uniqueVisitorsByWeekdayRaw,
  ] = await Promise.all([
    prismaClient.menuItemInterestEvent.count({
      where: {
        createdAt: { gte: currentMonth.start, lt: currentMonth.end },
        ...viewListFilter,
      },
    }),
    prismaClient.menuItemInterestEvent.count({
      where: {
        createdAt: { gte: previousMonth.start, lt: previousMonth.end },
        ...viewListFilter,
      },
    }),
    prismaClient.menuItemInterestEvent.count({
      where: {
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
        ...viewListFilter,
      },
    }),
    prismaClient.menuItemInterestEvent.groupBy({
      by: ["clientId"],
      _count: { _all: true },
      where: {
        createdAt: { gte: currentMonth.start, lt: currentMonth.end },
        clientId: { not: null },
        ...viewListFilter,
      },
    }),
    prismaClient.menuItemInterestEvent.groupBy({
      by: ["clientId"],
      _count: { _all: true },
      where: {
        createdAt: { gte: previousMonth.start, lt: previousMonth.end },
        clientId: { not: null },
        ...viewListFilter,
      },
    }),
    prismaClient.menuItemInterestEvent.groupBy({
      by: ["clientId"],
      _count: { _all: true },
      where: {
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
        clientId: { not: null },
        ...viewListFilter,
      },
    }),
    prismaClient.$queryRaw<{ hour: number | null; count: number }[]>(
      Prisma.sql`
        SELECT date_part('hour', created_at) AS hour,
               COUNT(DISTINCT client_id) AS count
        FROM menu_item_interest_events
        WHERE created_at >= ${currentMonth.start}
          AND created_at < ${currentMonth.end}
          AND client_id IS NOT NULL
          AND type = ${viewListFilter.type}
        GROUP BY 1
        ORDER BY 1
      `
    ),
    prismaClient.$queryRaw<{ day: number | null; count: number }[]>(
      Prisma.sql`
        SELECT date_part('dow', created_at) AS day,
               COUNT(DISTINCT client_id) AS count
        FROM menu_item_interest_events
        WHERE created_at >= ${currentMonth.start}
          AND created_at < ${currentMonth.end}
          AND client_id IS NOT NULL
          AND type = ${viewListFilter.type}
        GROUP BY 1
        ORDER BY 1
      `
    ),
  ]);

  const uniqueVisitorsByHour: HourCount[] = Array.from(
    { length: 24 },
    (_, hour) => ({
      hour,
      count: 0,
    })
  );

  uniqueVisitorsByHourRaw.forEach((row) => {
    if (row.hour == null) return;
    const hour = Math.floor(Number(row.hour));
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
    uniqueVisitorsByHour[hour].count = Number(row.count ?? 0);
  });

  const uniqueVisitorsByWeekday: WeekdayCount[] = Array.from(
    { length: 7 },
    (_, day) => ({
      day,
      count: 0,
    })
  );

  uniqueVisitorsByWeekdayRaw.forEach((row) => {
    if (row.day == null) return;
    const day = Math.floor(Number(row.day));
    if (!Number.isFinite(day) || day < 0 || day > 6) return;
    uniqueVisitorsByWeekday[day].count = Number(row.count ?? 0);
  });

  return json({
    currentMonth: currentMonth.label,
    previousMonth: previousMonth.label,
    monthOptions,
    rangeOptions,
    rangeValue: range.value,
    rangeLabel: range.label,
    totalVisitsCurrent,
    totalVisitsPrevious,
    totalVisitsTotal,
    uniqueVisitorsCurrent: uniqueVisitorsCurrent.length,
    uniqueVisitorsPrevious: uniqueVisitorsPrevious.length,
    uniqueVisitorsTotal: uniqueVisitorsTotal.length,
    uniqueVisitorsByHour,
    uniqueVisitorsByWeekday,
  });
}

export default function AdminGerenciamentoCardapioVisitas() {
  const {
    currentMonth,
    previousMonth,
    monthOptions,
    rangeOptions,
    rangeValue,
    rangeLabel,
    totalVisitsCurrent,
    totalVisitsPrevious,
    totalVisitsTotal,
    uniqueVisitorsCurrent,
    uniqueVisitorsPrevious,
    uniqueVisitorsTotal,
    uniqueVisitorsByHour,
    uniqueVisitorsByWeekday,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const selectedMonth = searchParams.get("month") ?? currentMonth;
  const selectedRange = searchParams.get("range") ?? rangeValue;
  const currentLabel =
    monthOptions.find((option) => option.value === currentMonth)?.label ??
    currentMonth;
  const previousLabel =
    monthOptions.find((option) => option.value === previousMonth)?.label ??
    previousMonth;

  const pctDiff = (curr?: number, ref?: number) => {
    const c = Number(curr ?? 0);
    const r = Number(ref ?? 0);
    if (!isFinite(c) || !isFinite(r) || r === 0) {
      return { text: "--", cls: "text-muted-foreground" };
    }
    const p = ((c - r) / r) * 100;
    const sign = p > 0 ? "▲" : p < 0 ? "▼" : "▲";
    const color =
      p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-slate-500";
    return { text: `${sign} ${Math.abs(p).toFixed(1)}%`, cls: color };
  };
  const formatNumber = new Intl.NumberFormat("pt-BR");
  const visitsDiff = pctDiff(totalVisitsCurrent, totalVisitsPrevious);
  const uniqueDiff = pctDiff(uniqueVisitorsCurrent, uniqueVisitorsPrevious);
  const maxUniqueVisitorsByHour = Math.max(
    ...uniqueVisitorsByHour.map((entry) => entry.count),
    1
  );
  const maxUniqueVisitorsByWeekday = Math.max(
    ...uniqueVisitorsByWeekday.map((entry) => entry.count),
    1
  );
  const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Dashboard
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Visitas do cardapio
          </h2>
          <p className="text-sm text-slate-600">
            Acompanhe o volume de visitas e o comportamento dos visitantes no
            cardapio.
          </p>
        </div>
        <form className="mt-1 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mes
          </label>
          <div className="flex items-center gap-2">
            <select
              name="month"
              defaultValue={selectedMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="range"
              defaultValue={selectedRange}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm transition hover:border-slate-300"
            >
              Atualizar
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            Comparando {currentLabel} x {previousLabel} · {rangeLabel}
          </span>
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Resumo de visitas
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Visitas totais (view_list) e visitantes unicos (clientId) do mes.
          </p>
          <div className="mt-4 overflow-x-auto rounded-md border border-muted">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Metrica</th>
                  <th className="px-3 py-2 text-right font-medium">Mes atual</th>
                  <th className="px-3 py-2 text-right font-medium">Mes anterior</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total ({rangeLabel})
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    Visitas no cardapio
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    {formatNumber.format(totalVisitsCurrent)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {formatNumber.format(totalVisitsPrevious)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {formatNumber.format(totalVisitsTotal)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs font-semibold ${visitsDiff.cls}`}
                  >
                    {visitsDiff.text}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    Visitantes unicos
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    {formatNumber.format(uniqueVisitorsCurrent)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {formatNumber.format(uniqueVisitorsPrevious)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {formatNumber.format(uniqueVisitorsTotal)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs font-semibold ${uniqueDiff.cls}`}
                  >
                    {uniqueDiff.text}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Visitantes unicos por horario
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Distribuicao de clientes unicos por hora do dia (mes atual).
            </p>
            <div className="mt-4">
              <div className="h-40 rounded-md border border-muted bg-slate-50 px-3 py-3">
                <div
                  className="grid h-full items-end gap-2"
                  style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                >
                {uniqueVisitorsByHour.map((entry) => {
                  const height = Math.max(
                    4,
                    Math.round((entry.count / maxUniqueVisitorsByHour) * 100)
                  );
                  return (
                    <div
                      key={entry.hour}
                      className="flex h-full flex-col items-center justify-end gap-2"
                      title={`${entry.hour}h: ${formatNumber.format(entry.count)}`}
                    >
                      <span className="text-[10px] font-semibold text-slate-500">
                        {entry.count > 0 ? formatNumber.format(entry.count) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-slate-700"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-12 text-[11px] text-muted-foreground">
                {Array.from({ length: 12 }).map((_, index) => {
                  const hour = index * 2;
                  return (
                    <span key={hour} className="text-center">
                      {String(hour).padStart(2, "0")}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Visitantes unicos por dia
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Distribuicao de clientes unicos por dia da semana (mes atual).
            </p>
            <div className="mt-4">
              <div className="h-40 rounded-md border border-muted bg-slate-50 px-4 py-3">
                <div className="grid h-full grid-cols-7 items-end gap-6">
                {uniqueVisitorsByWeekday.map((entry) => {
                  const height = Math.max(
                    4,
                    Math.round((entry.count / maxUniqueVisitorsByWeekday) * 100)
                  );
                  return (
                    <div
                      key={entry.day}
                      className="flex h-full flex-col items-center justify-end gap-2"
                      title={`${weekdayLabels[entry.day]}: ${formatNumber.format(entry.count)}`}
                    >
                      <span className="text-[10px] font-semibold text-slate-500">
                        {entry.count > 0 ? formatNumber.format(entry.count) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-slate-700"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {weekdayLabels[entry.day]}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
