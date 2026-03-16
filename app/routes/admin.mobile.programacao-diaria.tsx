import { type MetaFunction } from "@remix-run/node";
import { Await, useLoaderData, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import type { loader as desktopLoader } from "./admin.producao.programacao-diaria";

export { loader } from "./admin.producao.programacao-diaria";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Programação diária" }];

const WEEKDAY_OPTIONS = [
  { value: "domingo", label: "Domingo" },
  { value: "segunda", label: "Segunda" },
  { value: "terca", label: "Terça" },
  { value: "quarta", label: "Quarta" },
  { value: "quinta", label: "Quinta" },
  { value: "sexta", label: "Sexta" },
  { value: "sabado", label: "Sábado" },
] as const;

const SIZE_SHORT_LABEL: Record<string, string> = {
  "Família": "F",
  "Médio": "M",
  "Individual": "I",
  "Pequena": "P",
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

function toDateShort(dateInt: number) {
  const raw = String(dateInt);
  const date = new Date(
    Number(raw.slice(0, 4)),
    Number(raw.slice(4, 6)) - 1,
    Number(raw.slice(6, 8))
  );

  return format(date, "dd/MM", { locale: ptBR });
}

export default function AdminMobileProgramacaoDiaria() {
  const data = useLoaderData<typeof desktopLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stockBySize, setStockBySize] =
    React.useState<StockBySize>(createDefaultStock);

  const weekday = (data.weekday as string) || "domingo";
  const pct = Number(data.pct ?? 0);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function bumpPct(delta: number) {
    const next = Math.max(-50, Math.min(200, (Number.isFinite(pct) ? pct : 0) + delta));
    setParam("pct", String(next));
  }

  function setStock(size: keyof StockBySize, value: string) {
    const parsed = Number(value);
    setStockBySize((current) => ({
      ...current,
      [size]:
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : 0,
    }));
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Dia da semana</p>
        <select
          value={weekday}
          onChange={(event) => setParam("weekday", event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {WEEKDAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <p className="mt-4 text-sm font-semibold text-slate-900">Ajuste da previsão</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[-10, -5, 5, 10].map((step) => (
            <Button
              key={step}
              type="button"
              variant="secondary"
              onClick={() => bumpPct(step)}
              className="h-10 text-xs"
            >
              {step > 0 ? `+${step}%` : `${step}%`}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={-50}
            max={200}
            value={Number.isFinite(pct) ? pct : 0}
            onChange={(event) => setParam("pct", event.target.value || "0")}
            className="h-11 w-24 rounded-md border border-slate-300 px-3 text-sm"
          />
          <span className="text-sm text-slate-600">%</span>
          <Button type="button" variant="outline" onClick={() => setParam("pct", "0")} className="h-10">
            Reset
          </Button>
        </div>

      </section>

      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <Await resolve={data.stats}>
          {(stats: any) => (
            <>
              <section className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Previsão por tamanho ({pct}%)</p>
                <div className="space-y-2">
                  {stats.perSize.map((row: any) => {
                    const stock =
                      stockBySize[row.size as keyof StockBySize] ?? 0;
                    const productionForecast = Math.max(
                      (row.forecast ?? 0) - stock,
                      0
                    );

                    return (
                      <article
                        key={row.size}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <div className="min-w-0">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                              {row.size}
                            </h2>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                              <span>Min: {row.min}</span>
                              <span>Média: {row.avg}</span>
                              <span>Freq: {row.freqPct}%</span>
                            </div>
                          </div>
                          <div className="flex min-w-[3rem] items-start justify-end">
                            <span className="font-mono text-2xl font-bold leading-none text-blue-700">
                              {productionForecast}
                            </span>
                          </div>
                          <div className="col-span-2 grid grid-cols-[1fr_120px] items-end gap-3">
                            <div className="text-xs text-slate-600">
                              <span className="font-medium text-slate-700">
                                Estoque atual
                              </span>
                            </div>
                            <NumericInput
                              decimalScale={0}
                              min={0}
                              step={1}
                              value={stock}
                              onChange={(event) =>
                                setStock(
                                  row.size as keyof StockBySize,
                                  event.target.value
                                )
                              }
                              className="h-10 text-base"
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Últimos dias ({weekday})</p>
                <div className="space-y-2">
                  {[...stats.lastByDate].reverse().map((row: any) => (
                    <article key={row.dateInt} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-900">{toDateShort(row.dateInt)}</span>
                        <div className="flex flex-wrap justify-end gap-1.5 text-slate-700">
                          {stats.sizes.map((size: string) => (
                            <span
                              key={`${row.dateInt}-${size}`}
                              className="rounded-sm bg-slate-100 px-2 py-0.5 text-xs"
                            >
                              {`${SIZE_SHORT_LABEL[size] || size}: `}
                              <span className="font-mono text-base font-bold leading-none">{row.counts[size] ?? 0}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
