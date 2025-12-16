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
import { Switch } from "@/components/ui/switch";

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
  // Custos fixos
  { key: "custoFixo", label: "Custo fixo total", kind: "money", getValue: (c) => c?.custoFixoTotal },
  // Resultado
  { key: "resultadoLiquido", label: "Resultado líquido", kind: "money", getValue: (c) => c?.resultadoLiquido },
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
  const [showNumericDiffs, setShowNumericDiffs] = React.useState(false);

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
    if (!selectedYear) return { prevMonth: null, prevYear: null, prevMonthBase: null, prevYearBase: null };
    const prevMonthKey = month === 1 ? `${selectedYear - 1}-12` : `${selectedYear}-${month - 1}`;
    const prevYearKey = `${selectedYear - 1}-${month}`;

    const currentValue = getNumericValue(metric.getValue(monthlyData[month]), metric.kind);
    const prevMonthValue = getNumericValue(normalizedAll[prevMonthKey] ? metric.getValue(normalizedAll[prevMonthKey]) : null, metric.kind);
    const prevYearValue = getNumericValue(normalizedAll[prevYearKey] ? metric.getValue(normalizedAll[prevYearKey]) : null, metric.kind);

    return {
      prevMonth: currentValue != null && prevMonthValue != null ? currentValue - prevMonthValue : null,
      prevYear: currentValue != null && prevYearValue != null ? currentValue - prevYearValue : null,
      prevMonthBase: prevMonthValue ?? null,
      prevYearBase: prevYearValue ?? null,
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Mostrar valores absolutos</span>
              <Switch
                checked={showNumericDiffs}
                onCheckedChange={setShowNumericDiffs}
                className="scale-90"
              />
            </div>
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
                getDiffs={getDiffs}
                showNumeric={showNumericDiffs}
              />
              <Separator className="my-4" />
              <MetricsTable
                metrics={MAIN_METRICS}
                monthlyData={monthlyData}
                getDiffs={getDiffs}
                showNumeric={showNumericDiffs}
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
  getDiffs,
  showNumeric,
}: {
  metrics: MetricRow[];
  monthlyData: Record<number, NormalizedMonthlyClose | null>;
  getDiffs: (month: number, metric: MetricRow) => { prevMonth: number | null; prevYear: number | null; prevMonthBase: number | null; prevYearBase: number | null };
  showNumeric: boolean;
}) {
  const getInlinePercent = (
    rowKey: string,
    month: number,
    data: Record<number, NormalizedMonthlyClose | null>,
  ): number | null => {
    const close = data[month];
    if (!close) return null;
    if (rowKey === "margemContrib") return close.margemContribPerc ?? null;
    if (rowKey === "resultadoLiquido") return close.resultadoLiquidoPercBruta ?? null;
    if (rowKey === "coberturaPe") return close.pontoEquilibrio > 0 ? (close.receitaBruta / close.pontoEquilibrio) * 100 : null;
    return null;
  };

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
          {metrics.map((row) => {
            const isMargem = row.key === "margemContrib";
            const isResultado = row.key === "resultadoLiquido";
            const rowBg = isMargem ? "bg-amber-50/60" : isResultado ? "bg-amber-100/60" : "";
            return (
              <TableRow key={row.key} className={rowBg}>
                <TableCell className={`bg-background sticky left-0 z-10 text-sm font-semibold ${rowBg}`}>
                  {row.label}
                </TableCell>
                {MONTH_OPTIONS.map((month) => {
                  const close = monthlyData[month.value];
                  const rawValue = row.getValue(close);
                  const { prevMonth, prevYear, prevMonthBase, prevYearBase } = getDiffs(month.value, row);
                  const inlinePercent = getInlinePercent(row.key, month.value, monthlyData);
                  const isCobertura = row.key === "coberturaPe";
                  const isMargemRow = row.key === "margemContrib";
                  const isResultadoRow = row.key === "resultadoLiquido";
                  const isHighlightRow = isMargemRow || isResultadoRow;
                  const showDiffs = (!inlinePercent || isResultadoRow) && !isCobertura && !isMargemRow;
                  const showMarginPrevMonth = isMargemRow;
                  const invertTone = ["custoVariavel", "custoFixo", "pontoEquilibrio"].includes(row.key);
                  const displayValue = row.kind === "percent" && inlinePercent != null
                    ? `${inlinePercent.toFixed(2)}%`
                    : formatCellValue(rawValue, row.kind);
                  return (
                    <TableCell
                      key={`${row.key}-${month.value}`}
                      className="text-right"
                    >
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-foreground ${isHighlightRow ? "font-semibold" : "font-medium"}`}>
                            {displayValue}
                          </span>
                          {inlinePercent != null && row.kind !== "percent" && (
                            <span className={`text-[11px] text-muted-foreground ${isHighlightRow ? "font-semibold" : ""}`}>
                              {inlinePercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        {showDiffs && (
                          <div className="flex flex-col items-end gap-1 text-[11px]">
                            <DiffPill diff={prevMonth} base={prevMonthBase} kind={row.kind} invert={invertTone} showNumeric={showNumeric} />
                            <DiffPill diff={prevYear} base={prevYearBase} kind={row.kind} invert={invertTone} showNumeric={showNumeric} />
                          </div>
                        )}
                        {showMarginPrevMonth && (
                          <div className="flex flex-col items-end gap-1 text-[11px]">
                            <DiffPill diff={prevMonth} base={prevMonthBase} kind="money" showNumeric={showNumeric} />
                            {prevMonth != null && (
                              <span className="text-[11px] text-muted-foreground text-right leading-snug">
                                {prevMonth < 0 ? "menos" : "mais"} p/ fixos e lucro
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

type DiffPillProps = {
  diff: number | null;
  kind: "money" | "percent";
  invert?: boolean;
  base?: number | null;
  showNumeric?: boolean;
};

const DiffPill = React.forwardRef<HTMLSpanElement, DiffPillProps>(({ diff, kind, invert, base, showNumeric = true }, ref) => {
  if (diff == null) {
    return <span ref={ref} className="text-muted-foreground">—</span>;
  }
  const positive = diff > 0;
  const negative = diff < 0;
  const tonePositive = invert ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50";
  const toneNegative = invert ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
  const tone = positive ? tonePositive : negative ? toneNegative : "text-muted-foreground bg-muted";
  const arrow = positive ? "▲" : negative ? "▼" : "•";
  const formatted = kind === "percent" ? `${diff.toFixed(2)}%` : formatMoneyString(diff, 2);
  const percentChange = base != null && base !== 0 ? (diff / base) * 100 : null;
  const percentTone = percentChange != null
    ? percentChange > 0
      ? tonePositive
      : percentChange < 0
        ? toneNegative
        : "text-muted-foreground bg-muted"
    : "text-muted-foreground bg-muted";
  return (
    <span ref={ref} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${tone}`}>
      <span aria-hidden>{arrow}</span>
      {showNumeric && (
        <span className="font-mono font-semibold">{formatted}</span>
      )}
      {percentChange != null && (
        <span className={`text-[11px] rounded px-1 py-[1px] font-mono font-semibold ${percentTone}`}>
          {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
        </span>
      )}
      {!showNumeric && percentChange == null && (
        <span className="text-[11px] text-muted-foreground">—</span>
      )}
    </span>
  );
});
DiffPill.displayName = "DiffPill";
