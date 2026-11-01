// app/routes/admin.kds.producao.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useSearchParams,
  Await,
} from "@remix-run/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";
import {
  getDailyProgramming,
  loadWeeklyHistoryData,
} from "~/domain/production/daily-programming.server";
import { Suspense } from "react";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { BarChart3, Info } from "lucide-react";

// -----------------------------
// Utilidades de data/weekday
// -----------------------------
// -----------------------------
// Tipos
// -----------------------------
export type StatsRow = {
  size: string;
  min: number;
  max: number;
  avg: number; // média simples histórica
  forecast: number; // previsão final (média ponderada + frequência + %)
  freqDays: number; // em quantos dias teve venda > 0
  freqPct: number; // % de dias com venda > 0
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

const PROGRAMACAO_SIZES = [
  "Família",
  "Médio",
  "Individual",
  "Pequena",
] as const;

type StockBySize = Record<(typeof PROGRAMACAO_SIZES)[number], number>;

function createDefaultStock(): StockBySize {
  return {
    Família: 0,
    Médio: 0,
    Individual: 0,
    Pequena: 0,
  };
}

// -----------------------------
// Loader com defer/Await/Suspense
// -----------------------------
export async function loader({ request }: LoaderFunctionArgs) {
  if (new URL(request.url).searchParams.get("weeklyHistory") === "1") {
    return json(await loadWeeklyHistoryData(request));
  }
  return defer(getDailyProgramming(request));
}

// -----------------------------
// Componente
// -----------------------------
function WeeklyHistoryDialog() {
  const fetcher = useFetcher<any>();
  const [open, setOpen] = React.useState(false);
  const [weeksCount, setWeeksCount] = React.useState("3");

  function loadWeeks(value: string) {
    setWeeksCount(value);
    fetcher.load(
      `/admin/producao/programacao-diaria?weeklyHistory=1&weeks=${value}`
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !fetcher.data) {
      loadWeeks(weeksCount);
    }
  }

  const isLoading = fetcher.state !== "idle";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <BarChart3 className="mr-2 h-5 w-5" />
          Ver histórico semanal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico por tamanho</DialogTitle>
          <DialogDescription>
            Totais das semanas completas, sem considerar o filtro de dia.
          </DialogDescription>
        </DialogHeader>

        <div className="w-44 space-y-2">
          <Label>Semanas</Label>
          <Select value={weeksCount} onValueChange={loadWeeks}>
            <SelectTrigger>
              <SelectValue placeholder="Quantidade" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (amount) => (
                  <SelectItem key={amount} value={String(amount)}>
                    {amount} {amount === 1 ? "semana" : "semanas"}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {isLoading || !fetcher.data ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {fetcher.data.weeklyBySize.map((item: any) => (
              <div
                key={item.size}
                className="rounded-lg border bg-background px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold uppercase tracking-wide text-slate-950">
                      {item.size}
                    </div>
                    <div className="mt-1 text-sm font-bold tabular-nums text-muted-foreground">
                      mín {item.min} · máx {item.max}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Total
                    </div>
                    <div className="font-mono text-5xl font-bold leading-none tracking-tight text-blue-700">
                      {item.total}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function KdsProducaoPage() {
  const data = useLoaderData<any>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stockBySize, setStockBySize] =
    React.useState<StockBySize>(createDefaultStock);

  // % controlada com debounce
  const [localPct, setLocalPct] = React.useState<number>(
    (data.pct as number) ?? 10
  );
  React.useEffect(() => setLocalPct((data.pct as number) ?? 0), [data.pct]);
  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.set("pct", String(localPct ?? 0));
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [localPct, searchParams, setSearchParams]);

  function bumpPct(delta: number) {
    setLocalPct((v) =>
      Math.max(-50, Math.min(200, (Number.isFinite(v) ? v : 0) + delta))
    );
  }
  function resetPct() {
    setLocalPct(0);
  }

  function setStock(size: keyof StockBySize, value: string) {
    const parsed = Number(value);
    setStockBySize((current) => ({
      ...current,
      [size]: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0,
    }));
  }

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Produção diária por tamanho</h1>
            <p className="text-sm text-muted-foreground">
              Selecione o dia da semana e ajuste a previsão por %.
            </p>
          </div>
          <WeeklyHistoryDialog />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="rounded-xl border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
                <div className="mt-2 grid grid-cols-5 gap-2 text-xs">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => bumpPct(-10)}
                  >
                    -10%
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => bumpPct(-5)}
                  >
                    -5%
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => bumpPct(5)}
                  >
                    +5%
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => bumpPct(10)}
                  >
                    +10%
                  </Button>
                  <Button type="button" variant="outline" onClick={resetPct}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-8 w-36" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            }
          >
            <Await resolve={data.stats}>
              {(res: any) => {
                const items = res.perSize.map((row: any) => {
                  const currentStock =
                    stockBySize[row.size as keyof StockBySize] ?? 0;
                  const toProduce = Math.max(
                    (row.forecast ?? 0) - currentStock,
                    0
                  );

                  return {
                    size: row.size,
                    toProduce,
                    min: row.min ?? 0,
                    avg: row.avg ?? 0,
                  };
                });

                return (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        Dia selecionado
                      </p>
                      <p className="text-2xl font-bold  text-slate-950 uppercase">
                        {weekday}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {items.map((item: any) => (
                        <div
                          key={item.size}
                          className="rounded-lg border bg-background px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                              <div className="text-lg font-bold uppercase tracking-wide text-slate-950">
                                {item.size}
                              </div>
                              <div className="text-xl font-semibold tabular-nums flex gap-2">
                                <span className="text-muted-foreground text-2xl font-bold">
                                  mín {item.min}
                                </span>
                                <span className="text-slate-400">
                                  · méd {Math.ceil(item.avg)}
                                </span>
                              </div>
                            </div>
                            <div className="font-mono text-6xl font-bold leading-none tracking-tight text-blue-700">
                              {item.toProduce}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            </Await>
          </Suspense>
        </div>
      </header>

      {/* Seção 1: Últimos N para o weekday */}
      <Card className="shadow-sm p-0">
        <CardHeader>
          <CardTitle>
            Vendas — Últimos {n} {weekday}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            }
          >
            <Await resolve={data.stats}>
              {(res: any) => (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1 md:p-2 sticky left-0 bg-background">
                          Data
                        </th>
                        {res.sizes.map((s: string) => (
                          <th key={s} className="text-right p-1 md:p-2">
                            <span className="hidden md:block">{s}</span>
                            <span className="md:hidden uppercase">
                              {s.substring(0, 2)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {res.lastByDate.map((row: any) => {
                        const di = String(row.dateInt);
                        const date = new Date(
                          Number(di.slice(0, 4)),
                          Number(di.slice(4, 6)) - 1,
                          Number(di.slice(6, 8))
                        );
                        const dateStr = format(date, "dd/MM", {
                          locale: ptBR,
                        });
                        return (
                          <tr
                            key={row.dateInt}
                            className="border-b hover:bg-muted/30"
                          >
                            <td className="p-2 font-medium sticky left-0 bg-background">
                              {dateStr}
                            </td>
                            {res.sizes.map((s: string) => (
                              <td
                                key={s}
                                className="text-right p-2 tabular-nums"
                              >
                                {row.counts[s] ?? 0}
                              </td>
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
          <Suspense
            fallback={
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            }
          >
            <Await resolve={data.stats}>
              {(res: any) => {
                const [showInfo, setShowInfo] = React.useState(false);

                return (
                  <div className="overflow-x-auto">
                    <Alert className="mb-4">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          <AlertTitle>
                            Como interpretar esses números
                          </AlertTitle>
                        </div>

                        <button
                          onClick={() => setShowInfo(!showInfo)}
                          className="text-xs hover:underline"
                        >
                          {showInfo ? "Esconder" : "Ver"}
                        </button>
                      </div>

                      {showInfo && (
                        <AlertDescription className="mt-2 space-y-2 text-sm">
                          <p>
                            A coluna <strong>Média</strong> mostra quanto você
                            vendeu, em média, nas últimas semanas para cada
                            tamanho. Já a coluna
                            <strong> % Dias c/ venda</strong> indica em quantos
                            dias esse tamanho realmente apareceu, ajudando a
                            entender <strong>não só o volume</strong>, mas
                            também
                            <strong> a constância</strong> das vendas.
                          </p>

                          <p>
                            – Se um tamanho tem média alta e frequência alta,
                            ele é<strong> regular</strong> (quase sempre vende).
                            <br />– Se a média é baixa e a frequência também é
                            baixa, ele é um item
                            <strong> de evento</strong> (vende só em dias
                            específicos).
                          </p>

                          <p>
                            A previsão utiliza uma{" "}
                            <strong>média ponderada</strong>, dando mais peso
                            para as semanas mais recentes, combinada com a
                            <strong> frequência de venda</strong> e o ajuste
                            percentual definido acima.
                          </p>
                        </AlertDescription>
                      )}
                    </Alert>

                    <table className="min-w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-1 md:p-2">Produto</th>
                          <th className="text-right p-1 md:p-2">Mínimo</th>
                          <th className="text-right p-1 md:p-2">Máximo</th>
                          <th className="text-right p-1 md:p-2">Média</th>
                          <th className="text-right p-1 md:p-2">
                            % Dias c/ venda
                          </th>
                          <th className="text-right p-1 md:p-2">
                            Estoque atual
                          </th>
                          <th className="text-right p-1 md:p-2">
                            Produzir ({pct}%)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.perSize.map((r: any) => {
                          const currentStock =
                            stockBySize[r.size as keyof StockBySize] ?? 0;
                          const productionForecast = Math.max(
                            (r.forecast ?? 0) - currentStock,
                            0
                          );

                          return (
                            <tr
                              key={r.size}
                              className="border-b hover:bg-muted/30"
                            >
                              <td className="p-2 font-medium">{r.size}</td>
                              <td className="text-right p-1 md:p-2 tabular-nums">
                                {r.min}
                              </td>
                              <td className="text-right p-1 md:p-2 tabular-nums">
                                {r.max}
                              </td>
                              <td className="text-right p-1 md:p-2 tabular-nums">
                                {r.avg}
                              </td>
                              <td className="text-right p-1 md:p-2 tabular-nums">
                                {r.freqPct}%
                              </td>
                              <td className="p-1 md:p-2">
                                <NumericInput
                                  decimalScale={0}
                                  min={0}
                                  step={1}
                                  value={currentStock}
                                  onChange={(e) =>
                                    setStock(
                                      r.size as keyof StockBySize,
                                      e.target.value
                                    )
                                  }
                                  className="h-9 w-24 ml-auto text-base text-right tabular-nums"
                                />
                              </td>
                              <td className="text-right p-1 md:p-2 tabular-nums font-semibold">
                                {productionForecast}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              }}
            </Await>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
