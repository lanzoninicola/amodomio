import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import type { StatsRow } from "../../../apps/mobile/src/production/types";
const PROGRAMACAO_SIZES = [
  "Família",
  "Médio",
  "Individual",
  "Pequena",
] as const;
const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

const WEEKDAY_NAMES = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

function getLastNDatesForWeekday(
  targetWeekday: number,
  n: number,
  fromDate = new Date()
): Date[] {
  const out: Date[] = [];
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    if (d.getDay() === targetWeekday) {
      out.push(new Date(d));
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
  }
  return out;
}

function toDateInt(date: Date): number {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return Number(`${y}${m}${d}`);
}

export async function loadWeeklyHistoryData(request: Request) {
  const url = new URL(request.url);
  const requestedWeeks = Number(url.searchParams.get("weeks") || 3);
  const weeksCount = Number.isFinite(requestedWeeks)
    ? Math.max(1, Math.min(12, Math.floor(requestedWeeks)))
    : 3;
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const completeWeeks = Array.from(
    { length: weeksCount },
    (_, index) => weeksCount - index
  ).map((weeksAgo) => {
    const start = subWeeks(currentWeekStart, weeksAgo);
    const end = endOfWeek(start, { weekStartsOn: 1 });

    return {
      startDateInt: toDateInt(start),
      endDateInt: toDateInt(end),
    };
  });
  type WeeklyRow = {
    dateInt: number;
    f: number;
    m: number;
    p: number;
    i: number;
  };
  const rows = await prismaClient.$queryRaw<WeeklyRow[]>`
    SELECT
      d."date_int" AS "dateInt",
      COALESCE( (SUM( (d."size"::jsonb->>'F')::int ))::int, 0 ) AS f,
      COALESCE( (SUM( (d."size"::jsonb->>'M')::int ))::int, 0 ) AS m,
      COALESCE( (SUM( (d."size"::jsonb->>'P')::int ))::int, 0 ) AS p,
      COALESCE( (SUM( (d."size"::jsonb->>'I')::int ))::int, 0 ) AS i
    FROM "kds_daily_order_details" d
    WHERE d."deleted_at" IS NULL
      AND d."date_int" BETWEEN ${completeWeeks[0].startDateInt}
        AND ${completeWeeks[completeWeeks.length - 1].endDateInt}
    GROUP BY d."date_int"
  `;
  const valueBySize = {
    Família: (row: WeeklyRow) => row.f ?? 0,
    Médio: (row: WeeklyRow) => row.m ?? 0,
    Individual: (row: WeeklyRow) => row.i ?? 0,
    Pequena: (row: WeeklyRow) => row.p ?? 0,
  };
  const weeklyBySize = PROGRAMACAO_SIZES.map((size) => {
    const totals = completeWeeks.map((week) =>
      rows
        .filter(
          (row) =>
            row.dateInt >= week.startDateInt && row.dateInt <= week.endDateInt
        )
        .reduce((sum, row) => sum + valueBySize[size](row), 0)
    );

    return {
      size,
      total: totals.reduce((sum, value) => sum + value, 0),
      min: Math.min(...totals),
      max: Math.max(...totals),
    };
  });

  return { weeksCount, weeklyBySize };
}

export function getDailyProgramming(request: Request) {
  const url = new URL(request.url);
  const currentWeekday = WEEKDAY_NAMES[new Date().getDay()];
  const weekdayParam = (
    url.searchParams.get("weekday") || currentWeekday
  ).toLowerCase();
  const rawPct = Number(url.searchParams.get("pct") ?? 10);
  const pctParam = Number.isFinite(rawPct)
    ? Math.max(-50, Math.min(200, rawPct))
    : 10;
  const rawN = Number(url.searchParams.get("n") ?? 6);
  const nParam = Number.isFinite(rawN)
    ? Math.max(1, Math.min(52, Math.floor(rawN)))
    : 6;

  const weekdayIndex = WEEKDAY_MAP[weekdayParam] ?? 0;
  const lastNDates = getLastNDatesForWeekday(weekdayIndex, nParam);
  const dateInts = lastNDates.map(toDateInt).sort();

  async function fetchStats() {
    // Muitos registros salvam `size` como JSON string (ex.: '{"F":0,"M":0,"P":0,"I":0}')
    // Somamos as chaves desse JSON por dia (Postgres)
    type Row = {
      dateInt: number;
      f: number;
      m: number;
      p: number;
      i: number;
      sem: number;
    };

    const rows = await prismaClient.$queryRaw<Row[]>`
      SELECT
        d."date_int" AS "dateInt",
        COALESCE( (SUM( (d."size"::jsonb->>'F')::int ))::int, 0 )  AS f,
        COALESCE( (SUM( (d."size"::jsonb->>'M')::int ))::int, 0 )  AS m,
        COALESCE( (SUM( (d."size"::jsonb->>'P')::int ))::int, 0 )  AS p,
        COALESCE( (SUM( (d."size"::jsonb->>'I')::int ))::int, 0 )  AS i,
        COALESCE(
          SUM(
            CASE
              WHEN d."size" IS NULL OR d."size" = '' THEN 1
              ELSE 0
            END
          ),
          0
        ) AS sem
      FROM "kds_daily_order_details" d
      WHERE d."deleted_at" IS NULL
        AND d."date_int" IN (${Prisma.join(dateInts)})
      GROUP BY d."date_int"
    `;

    const labels = ["Família", "Médio", "Individual", "Pequena"] as const;

    // Mapa por data
    const byDate = new Map<number, Record<string, number>>();
    for (const di of dateInts) {
      byDate.set(di, {
        Família: 0,
        Médio: 0,
        Pequena: 0,
        Individual: 0,
      });
    }

    for (const r of rows) {
      const rec = byDate.get(r.dateInt)!;
      rec["Família"] = r.f ?? 0;
      rec["Médio"] = r.m ?? 0;
      rec["Pequena"] = r.p ?? 0;
      rec["Individual"] = r.i ?? 0;
    }

    const lastByDate = dateInts.map((di) => ({
      dateInt: di,
      counts: byDate.get(di)!,
    }));

    // Filtra dias totalmente zerados (fechado ou sem venda nenhuma)
    const rowsForStats = lastByDate.filter((r: any) => {
      const total = Object.values(r.counts).reduce(
        (sum: number, v: any) => sum + (v ?? 0),
        0
      );
      // Só entra se teve pelo menos 1 pizza em qualquer tamanho
      return total > 0;
    });

    const baseRows = rowsForStats.length > 0 ? rowsForStats : lastByDate;

    const perSize: StatsRow[] = (labels as unknown as string[]).map((label) => {
      // valores por tamanho, apenas em dias com pelo menos 1 pizza (baseRows já filtrado)
      const values = baseRows.map((r) => r.counts[label] || 0);

      const min = Math.min(...values);
      const max = Math.max(...values);

      // 1) Média aritmética simples (referência histórica)
      const avg = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

      // 2) Média ponderada: dias mais recentes pesam mais
      const n = values.length;
      const weights = values.map((_, idx) => idx + 1); // 1,2,3,...,n
      const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1;

      const weightedAvg =
        values.reduce((sum, v, idx) => sum + v * weights[idx], 0) / weightSum;

      // 3) Frequência: em quantos dias esse tamanho apareceu (>0)
      const freqDays = values.filter((v) => v > 0).length;
      const freqPct = values.length > 0 ? (freqDays / values.length) * 100 : 0;

      // 4) Base da previsão:
      //    - usa média ponderada (volume recente)
      //    - multiplicada pelo fator de frequência (constância)
      //
      //    Ex: weightedAvg = 12, freqPct = 50% => baseForecast ≈ 6
      const freqFactor = freqPct / 100;
      const baseForecast = weightedAvg * freqFactor;

      // 5) Aplica o ajuste % da tela (pctParam)
      const pctFactor = 1 + (isNaN(pctParam) ? 0 : pctParam) / 100;
      const forecast = Math.round(baseForecast * pctFactor);

      return {
        size: label,
        min,
        max,
        avg: Number(avg.toFixed(2)), // coluna "Média"
        forecast, // coluna "Previsão"
        freqDays,
        freqPct: Number(freqPct.toFixed(1)), // % com 1 casa
      };
    });

    return {
      lastByDate,
      perSize,
      sizes: Array.from(labels),
    };
  }

  return {
    weekday: weekdayParam,
    dateInts,
    n: nParam,
    pct: isNaN(pctParam) ? 0 : pctParam,
    stats: fetchStats(),
  };
}
