// app/routes/admin.financeiro.fechamento-mensal.visualizar.tsx
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import { FinancialMonthlyClose } from "@prisma/client";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";
import { calcMonthlyCloseTotals } from "~/domain/finance/calc-monthly-close-totals";

type LoaderData = {
  selectedYear: number | null;
  years: number[];
  closes: FinancialMonthlyClose[];
  allCloses: FinancialMonthlyClose[];
  monthlyCloseRepoMissing?: boolean;
};

type NormalizedMonthlyClose = ReturnType<typeof normalizeMonthlyClose>;

type MetricRow = {
  key: string;
  label: string;
  kind: "money" | "percent";
  getValue: (close: NormalizedMonthlyClose | null) => number | string | null | undefined;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
];

const TOP_METRICS: MetricRow[] = [
  { key: "receitaLiquida", label: "Receita líquida", kind: "money", getValue: (c) => c?.receitaLiquida },
  { key: "faturamento", label: "Faturamento (informativo)", kind: "money", getValue: (c) => c?.faturamentoMensalAmount },
];

const MAIN_METRICS: MetricRow[] = [
  // Receitas
  { key: "receitaBruta", label: "Receita bruta (caixa)", kind: "money", getValue: (c) => c?.receitaBruta },
  // Custos variáveis
  { key: "custoVariavel", label: "Custo variável total", kind: "money", getValue: (c) => c?.custoVariavelTotal },
  // Margem de contribuição
  { key: "margemContrib", label: "Margem de contribuição", kind: "money", getValue: (c) => c?.margemContrib },
  { key: "margemContribPerc", label: "Margem de contribuição (%)", kind: "percent", getValue: (c) => c?.margemContribPerc },
  // Custos fixos
  { key: "custoFixo", label: "Custo fixo total", kind: "money", getValue: (c) => c?.custoFixoTotal },
  // Resultado
  { key: "resultadoLiquido", label: "Resultado líquido", kind: "money", getValue: (c) => c?.resultadoLiquido },
  { key: "resultadoLiquidoPerc", label: "Resultado líquido (%)", kind: "percent", getValue: (c) => c?.resultadoLiquidoPercBruta },
  // Ponto de equilíbrio
  { key: "pontoEquilibrio", label: "Ponto de equilíbrio", kind: "money", getValue: (c) => c?.pontoEquilibrio },
  {
    key: "coberturaPe",
    label: "Cobertura do PE (%)",
    kind: "percent",
    getValue: (c) => (c ? (c.pontoEquilibrio > 0 ? (c.receitaBruta / c.pontoEquilibrio) * 100 : 0) : null),
  },
];

export const meta: MetaFunction = () => [
  { title: "Visualizar fechamentos mensais | Admin" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const monthlyCloseRepo = (prismaClient as any).financialMonthlyClose;

  if (!monthlyCloseRepo || typeof monthlyCloseRepo.findMany !== "function") {
    return json<LoaderData>({
      selectedYear: null,
      years: [],
      closes: [],
      monthlyCloseRepoMissing: true,
    });
  }

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const yearNumber = yearParam ? Number(yearParam) : undefined;

  const allCloses = await monthlyCloseRepo.findMany({
    orderBy: [
      { referenceYear: "desc" },
      { referenceMonth: "asc" },
    ],
  });

  const years = Array.from(new Set(allCloses.map((c) => c.referenceYear))).sort((a, b) => b - a);
  const selectedYear = Number.isFinite(yearNumber) && years.includes(Number(yearNumber))
    ? Number(yearNumber)
    : years[0] ?? null;
  const closes = selectedYear ? allCloses.filter((c) => c.referenceYear === selectedYear) : [];

  return json<LoaderData>({
    selectedYear,
    years,
    closes,
    allCloses,
    monthlyCloseRepoMissing: false,
  });
}

function normalizeMonthlyClose(close: FinancialMonthlyClose) {
  const totals = calcMonthlyCloseTotals(close);

  return {
    ...totals,
    faturamentoMensalAmount: close.faturamentoMensalAmount ?? 0,
    notes: close.notes ?? "",
    referenceMonth: close.referenceMonth,
    referenceYear: close.referenceYear,
  };
}

function formatCellValue(
  value: number | string | null | undefined,
  kind: MetricRow["kind"],
) {
  if (value == null) return "—";
  if (kind === "text") {
    return value ? String(value) : "—";
  }
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (kind === "percent") return `${value.toFixed(2)}%`;
  return formatMoneyString(value, 2);
}

export default function AdminFinanceiroFechamentoMensalVisualizar() {
  const { closes, years, selectedYear, monthlyCloseRepoMissing, allCloses } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const monthlyData = React.useMemo(() => {
    const map: Record<number, NormalizedMonthlyClose | null> = {};
    MONTH_OPTIONS.forEach((m) => { map[m.value] = null; });
    closes.forEach((close) => {
      map[close.referenceMonth] = normalizeMonthlyClose(close);
    });
    return map;
  }, [closes]);

  const monthsWithData = closes.map((c) => c.referenceMonth);
  const hasData = closes.length > 0 && selectedYear != null;

  const normalizedAll = React.useMemo(() => {
    const map: Record<string, NormalizedMonthlyClose> = {};
    allCloses.forEach((close) => {
      const key = `${close.referenceYear}-${close.referenceMonth}`;
      map[key] = normalizeMonthlyClose(close);
    });
    return map;
  }, [allCloses]);

  const getNumericValue = (value: number | string | null | undefined, kind: MetricRow["kind"]) => {
    if (value == null) return null;
    if (typeof value === "number") return value;
    if (kind === "percent") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const getDiffs = (
    month: number,
    metric: MetricRow,
  ) => {
    if (!selectedYear) return { prevMonth: null, prevYear: null };
    const prevMonthKey = month === 1 ? `${selectedYear - 1}-12` : `${selectedYear}-${month - 1}`;
    const prevYearKey = `${selectedYear - 1}-${month}`;

    const currentValue = getNumericValue(metric.getValue(monthlyData[month]), metric.kind);
    const prevMonthValue = getNumericValue(normalizedAll[prevMonthKey] ? metric.getValue(normalizedAll[prevMonthKey]) : null, metric.kind);
    const prevYearValue = getNumericValue(normalizedAll[prevYearKey] ? metric.getValue(normalizedAll[prevYearKey]) : null, metric.kind);

    return {
      prevMonth: currentValue != null && prevMonthValue != null ? currentValue - prevMonthValue : null,
      prevYear: currentValue != null && prevYearValue != null ? currentValue - prevYearValue : null,
    };
  };

  if (monthlyCloseRepoMissing) {
    return (
      <Alert variant="destructive" className="max-w-3xl">
        <AlertTitle>Não foi possível carregar os fechamentos</AlertTitle>
        <AlertDescription>
          Tabela de fechamento mensal não encontrada. Rode `prisma migrate dev` e `prisma generate`.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fechamentos mensais</p>
        <h1 className="text-2xl font-semibold">Visualização por mês</h1>
        <p className="text-sm text-muted-foreground">
          Compare rapidamente os indicadores de cada fechamento. Selecione um ano e veja os meses em linha.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Selecione o ano</CardTitle>
              <p className="text-xs text-muted-foreground">
                Mostrando os fechamentos salvos para o período escolhido.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit">
              {years.length} {years.length === 1 ? "ano disponível" : "anos disponíveis"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {years.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fechamento registrado ainda.</p>
          ) : (
            <Form method="get" className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="year-select">
                Ano
              </label>
              <select
                id="year-select"
                name="year"
                defaultValue={selectedYear ?? years[0]}
                onChange={(e) => submit(e.currentTarget.form)}
                className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:border-foreground"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Fechamentos de {selectedYear ?? "—"}</CardTitle>
            {hasData ? (
              <p className="text-xs text-muted-foreground">
                {monthsWithData.length} {monthsWithData.length === 1 ? "mês preenchido" : "meses preenchidos"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum fechamento salvo para este ano.</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <p className="text-sm text-muted-foreground">Salve fechamentos para ver os valores nesta visão.</p>
          ) : (
            <>
              <MetricsTable
                metrics={TOP_METRICS}
                monthlyData={monthlyData}
                monthsWithData={monthsWithData}
                getDiffs={getDiffs}
              />
              <Separator className="my-4" />
              <MetricsTable
                metrics={MAIN_METRICS}
                monthlyData={monthlyData}
                monthsWithData={monthsWithData}
                getDiffs={getDiffs}
              />

              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                Valores exibem os mesmos cálculos do fechamento mensal. Diferenças comparam o mês anterior e o mesmo mês do ano anterior, quando disponíveis.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricsTable({
  metrics,
  monthlyData,
  monthsWithData,
  getDiffs,
}: {
  metrics: MetricRow[];
  monthlyData: Record<number, NormalizedMonthlyClose | null>;
  monthsWithData: number[];
  getDiffs: (month: number, metric: MetricRow) => { prevMonth: number | null; prevYear: number | null };
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1100px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-56 bg-background sticky left-0 z-20">Indicador</TableHead>
            {MONTH_OPTIONS.map((month) => (
              <TableHead
                key={month.value}
                className="text-center"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium">{month.label}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="bg-background sticky left-0 z-10 text-sm font-semibold">
                {row.label}
              </TableCell>
              {MONTH_OPTIONS.map((month) => {
                const close = monthlyData[month.value];
                const rawValue = row.getValue(close);
                const { prevMonth, prevYear } = getDiffs(month.value, row);
                return (
                  <TableCell
                    key={`${row.key}-${month.value}`}
                    className="text-right"
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono font-medium text-foreground">
                        {formatCellValue(rawValue, row.kind)}
                      </span>
                      <div className="flex flex-col items-end gap-1 text-[11px]">
                        <DiffPill diff={prevMonth} kind={row.kind} />
                        <DiffPill diff={prevYear} kind={row.kind} />
                      </div>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DiffPill({
  diff,
  kind,
}: {
  diff: number | null;
  kind: "money" | "percent";
}) {
  if (diff == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = diff > 0;
  const negative = diff < 0;
  const tone = positive ? "text-emerald-700 bg-emerald-50" : negative ? "text-red-700 bg-red-50" : "text-muted-foreground bg-muted";
  const arrow = positive ? "▲" : negative ? "▼" : "•";
  const formatted = kind === "percent" ? `${diff.toFixed(2)}%` : formatMoneyString(diff, 2);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono ${tone}`}>
      <span aria-hidden>{arrow}</span>
      <span className="font-semibold">{formatted}</span>
    </span>
  );
}
