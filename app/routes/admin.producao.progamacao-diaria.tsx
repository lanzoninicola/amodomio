// app/routes/admin.kds.producao.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { useLoaderData, useSearchParams, Await } from "@remix-run/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";
import { Prisma } from "@prisma/client";
import { Suspense } from "react";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import prismaClient from "~/lib/prisma/client.server";

// -----------------------------
// Utilidades de data/weekday
// -----------------------------
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

function getLastNDatesForWeekday(targetWeekday: number, n: number, fromDate = new Date()): Date[] {
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

// -----------------------------
// Tipos
// -----------------------------
export type StatsRow = {
  size: string;
  min: number;
  max: number;
  avg: number;
  forecast: number;
};

export type LoaderData = {
  weekday: string;
  dateInts: number[];
  n: number;
  pct: number;
  stats: Promise<{
    lastByDate: Array<{ dateInt: number; counts: Record<string, number> }>;
    perSize: StatsRow[];
    sizes: string[];
  }>;
};

// -----------------------------
// Loader com defer/Await/Suspense
// -----------------------------
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const weekdayParam = (url.searchParams.get("weekday") || "domingo").toLowerCase();
  const pctParam = Number(url.searchParams.get("pct") || 0);
  const nParam = Number(url.searchParams.get("n") || 6);

  const weekdayIndex = WEEKDAY_MAP[weekdayParam] ?? 0;
  const lastNDates = getLastNDatesForWeekday(weekdayIndex, nParam);
  const dateInts = lastNDates.map(toDateInt).sort();

  async function fetchStats() {
    // Muitos registros salvam `size` como JSON string (ex.: '{"F":0,"M":0,"P":0,"I":0,"FT":1}')
    // Somamos as chaves desse JSON por dia (Postgres)
    type Row = { dateInt: number; f: number; m: number; p: number; i: number; ft: number; sem: number };
    const rows = await prismaClient.$queryRaw<Row[]>`
      SELECT
        d."date_int" AS "dateInt",
        COALESCE( (SUM( (d."size"::jsonb->>'F')::int ))::int, 0 )  AS f,
        COALESCE( (SUM( (d."size"::jsonb->>'M')::int ))::int, 0 )  AS m,
        COALESCE( (SUM( (d."size"::jsonb->>'P')::int ))::int, 0 )  AS p,
        COALESCE( (SUM( (d."size"::jsonb->>'I')::int ))::int, 0 )  AS i,
        COALESCE( (SUM( (d."size"::jsonb->>'FT')::int ))::int, 0 ) AS ft,
        COALESCE(SUM( CASE WHEN d."size" IS NULL OR d."size" = '' THEN 1 ELSE 0 END ), 0) AS sem
      FROM "kds_daily_order_details" d
      WHERE d."deleted_at" IS NULL
        AND d."date_int" IN (${Prisma.join(dateInts)})
      GROUP BY d."date_int"
    `;

    const labels = ["Família", "Médio", "Individual", "Fatia", "Pequena"] as const; // ordem do exemplo

    // Mapa por data
    const byDate = new Map<number, Record<string, number>>();
    for (const di of dateInts) byDate.set(di, { Família: 0, Médio: 0, Pequena: 0, Individual: 0, Fatia: 0 });

    for (const r of rows) {
      const rec = byDate.get(r.dateInt)!;
      rec["Família"] = r.f ?? 0;
      rec["Médio"] = r.m ?? 0;
      rec["Pequena"] = r.p ?? 0;
      rec["Individual"] = r.i ?? 0;
      rec["Fatia"] = r.ft ?? 0;
    }

    const lastByDate = dateInts.map((di) => ({ dateInt: di, counts: byDate.get(di)! }));

    const perSize: StatsRow[] = (labels as unknown as string[]).map((label) => {
      const values = lastByDate.map((r) => r.counts[label] || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      const forecast = Math.round(avg * (1 + (isNaN(pctParam) ? 0 : pctParam) / 100));
      return { size: label, min, max, avg: Number(avg.toFixed(2)), forecast };
    });

    return { lastByDate, perSize, sizes: Array.from(labels) };
  }

  return defer({
    weekday: weekdayParam,
    dateInts,
    n: nParam,
    pct: isNaN(pctParam) ? 0 : pctParam,
    stats: fetchStats(),
  });
}

// -----------------------------
// Componente
// -----------------------------
export default function KdsProducaoPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // % controlada com debounce
  const [localPct, setLocalPct] = React.useState<number>((data.pct as number) ?? 0);
  React.useEffect(() => setLocalPct((data.pct as number) ?? 0), [data.pct]);
  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.set("pct", String(localPct ?? 0));
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [localPct]);

  function bumpPct(delta: number) {
    setLocalPct((v) => Math.max(-50, Math.min(200, (Number.isFinite(v) ? v : 0) + delta)));
  }
  function resetPct() { setLocalPct(0); }

  const weekdayOptions = [
    { value: "domingo", label: "Domingo" },
    { value: "segunda", label: "Segunda" },
    { value: "terca", label: "Terça" },
    { value: "quarta", label: "Quarta" },
    { value: "quinta", label: "Quinta" },
    { value: "sexta", label: "Sexta" },
    { value: "sabado", label: "Sábado" },
  ];

  function handleWeekdayChange(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("weekday", value);
    setSearchParams(next, { replace: true });
  }

  const weekday = (data.weekday as string) ?? "domingo";
  const n = (data.n as number) ?? 6;
  const pct = (data.pct as number) ?? 0;

  return (
    <div className="container mx-auto p-0 md:p-4 space-y-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produção diária por tamanho</h1>
          <p className="text-sm text-muted-foreground">Selecione o dia da semana e ajuste a previsão por %.</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="md:w-48">
            <Label>Dia da semana</Label>
            <Select value={weekday} onValueChange={handleWeekdayChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {weekdayOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:w-56">
            <Label>Previsão (±%)</Label>
            <Input
              type="number"
              inputMode="numeric"
              step={1}
              min={-50}
              max={200}
              value={Number.isFinite(localPct) ? localPct : 0}
              onChange={(e) => setLocalPct(Number(e.target.value || 0))}
            />
            <div className="flex gap-2 mt-2 text-xs">
              <Button type="button" variant="secondary" onClick={() => bumpPct(-10)}>-10%</Button>
              <Button type="button" variant="secondary" onClick={() => bumpPct(-5)}>-5%</Button>
              <Button type="button" variant="secondary" onClick={() => bumpPct(5)}>+5%</Button>
              <Button type="button" variant="secondary" onClick={() => bumpPct(10)}>+10%</Button>
              <Button type="button" variant="outline" onClick={resetPct}>Reset</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Seção 1: Últimos N para o weekday */}
      <Card className="shadow-sm p-0">
        <CardHeader>
          <CardTitle>Vendas — Últimos {n} {weekday}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}>
            <Await resolve={data.stats}>
              {(res: any) => (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1 md:p-2 sticky left-0 bg-background">Data</th>
                        {res.sizes.map((s: string) => (
                          <th key={s} className="text-right p-1 md:p-2">
                            <span className="hidden md:block">{s}</span>
                            <span className="md:hidden uppercase">{s.substring(0, 2)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {res.lastByDate.map((row: any) => {
                        const di = String(row.dateInt);
                        const date = new Date(Number(di.slice(0, 4)), Number(di.slice(4, 6)) - 1, Number(di.slice(6, 8)));
                        const dateStr = format(date, "dd/MM", { locale: ptBR });
                        return (
                          <tr key={row.dateInt} className="border-b hover:bg-muted/30">
                            <td className="p-2 font-medium sticky left-0 bg-background">{dateStr}</td>
                            {res.sizes.map((s: string) => (
                              <td key={s} className="text-right p-2 tabular-nums">{row.counts[s] ?? 0}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Await>
          </Suspense>
        </CardContent>
      </Card>

      {/* Seção 2: Estatísticas */}
      <Card className="shadow-sm p-0">
        <CardHeader>
          <CardTitle>Estatísticas com previsão — {weekday}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}>
            <Await resolve={data.stats}>
              {(res: any) => (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1 md:p-2">Produto</th>
                        <th className="text-right p-1 md:p-2">Mínimo</th>
                        <th className="text-right p-1 md:p-2">Máximo</th>
                        <th className="text-right p-1 md:p-2">Média</th>
                        <th className="text-right p-1 md:p-2">Previsão ({pct}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.perSize.map((r: any) => (
                        <tr key={r.size} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{r.size}</td>
                          <td className="text-right p-1 md:p-2 tabular-nums">{r.min}</td>
                          <td className="text-right p-1 md:p-2 tabular-nums">{r.max}</td>
                          <td className="text-right p-1 md:p-2 tabular-nums">{r.avg}</td>
                          <td className="text-right p-1 md:p-2 tabular-nums font-semibold">{r.forecast}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Await>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
