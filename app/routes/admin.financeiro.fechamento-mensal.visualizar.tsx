// app/routes/admin.financeiro.fechamento-mensal.visualizar.tsx
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import { FinancialMonthlyClose } from "@prisma/client";
import { FileJson } from "lucide-react";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";
import { calcMonthlyCloseTotals } from "~/domain/finance/calc-monthly-close-totals";
import { getMarginContribStatus } from "~/domain/finance/get-margin-contrib-status";

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

type ExportMetricValue = {
  value: number | null;
  inlinePercent: number | null;
  diffPrevMonth: number | null;
  diffPrevYear: number | null;
  prevMonthBase: number | null;
  prevYearBase: number | null;
};

type DiffViewMode = "both" | "prevMonth" | "prevYear" | "none";

const DIFF_VIEW_OPTIONS: { value: DiffViewMode; label: string }[] = [
  { value: "none", label: "Não mostrar diffs" },
  { value: "both", label: "Mês anterior + ano passado" },
  { value: "prevMonth", label: "Mês anterior" },
  { value: "prevYear", label: "Ano passado" },
];

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
  // Resultado não operacional (entra antes do resultado líquido)
  {
    key: "resultadoNaoOperacional",
    label: "Resultado não operacional",
    kind: "money",
    getValue: (c) => (c ? (c.entradasNaoOperacionais ?? 0) - (c.saidasNaoOperacionais ?? 0) : null),
  },
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

type MetricWithSection = MetricRow & { section: "top" | "main" };

const METRICS_WITH_SECTION: MetricWithSection[] = [
  ...TOP_METRICS.map((metric) => ({ ...metric, section: "top" as const })),
  ...MAIN_METRICS.map((metric) => ({ ...metric, section: "main" as const })),
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

function getNumericValue(value: number | string | null | undefined, kind: MetricRow["kind"]) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (kind === "percent") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default function AdminFinanceiroFechamentoMensalVisualizar() {
  const { closes, years, selectedYear, monthlyCloseRepoMissing, allCloses } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const { toast } = useToast();

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
  const [diffViewMode, setDiffViewMode] = React.useState<DiffViewMode>("prevMonth");

  const normalizedAll = React.useMemo(() => {
    const map: Record<string, NormalizedMonthlyClose> = {};
    allCloses.forEach((close) => {
      const key = `${close.referenceYear}-${close.referenceMonth}`;
      map[key] = normalizeMonthlyClose(close);
    });
    return map;
  }, [allCloses]);

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

  const exportPayload = React.useMemo(() => {
    const totals: Record<string, MetricTotals> = {};
    METRICS_WITH_SECTION.forEach((metric) => {
      totals[metric.key] = calculateMetricTotals(metric, monthlyData);
    });

    const months = MONTH_OPTIONS.map((month) => {
      const close = monthlyData[month.value];
      const metrics = METRICS_WITH_SECTION.reduce<Record<string, ExportMetricValue>>((acc, metric) => {
        const rawValue = metric.getValue(close);
        const inlinePercent = inlinePercentForRow(metric.key, month.value, monthlyData);
        const { prevMonth, prevYear, prevMonthBase, prevYearBase } = getDiffs(month.value, metric);
        const numericValue = metric.kind === "percent"
          ? inlinePercent ?? getNumericValue(rawValue, metric.kind)
          : getNumericValue(rawValue, metric.kind);

        acc[metric.key] = {
          value: numericValue,
          inlinePercent: inlinePercent ?? null,
          diffPrevMonth: prevMonth,
          diffPrevYear: prevYear,
          prevMonthBase,
          prevYearBase,
        };
        return acc;
      }, {});

      return {
        month: month.value,
        monthLabel: month.label,
        hasData: !!close,
        referenceYear: close?.referenceYear ?? selectedYear ?? null,
        notes: close?.notes ?? null,
        raw: close,
        metrics,
      };
    });

    return {
      meta: {
        selectedYear,
        monthsWithData,
        generatedAt: new Date().toISOString(),
        description: "Dados usados na página de visualização de fechamento mensal.",
      },
      schema: {
        months: MONTH_OPTIONS,
        metrics: METRICS_WITH_SECTION.map(({ getValue, section, ...metric }) => ({
          ...metric,
          section,
        })),
        fields: {
          value: "Valor numérico do indicador (money em moeda, percent como número).",
          inlinePercent: "Percentual exibido junto ao valor quando calculado na visão.",
          diffPrevMonth: "Diferença absoluta em relação ao mês anterior.",
          diffPrevYear: "Diferença absoluta em relação ao mesmo mês no ano anterior.",
          prevMonthBase: "Valor base do mês anterior usado para o cálculo da diferença.",
          prevYearBase: "Valor base do ano anterior usado para o cálculo da diferença.",
        },
      },
      months,
      totals,
    };
  }, [monthsWithData, monthlyData, selectedYear, getDiffs]);

  const handleExportJson = React.useCallback(async () => {
    const payloadWithTimestamp = {
      ...exportPayload,
      meta: { ...exportPayload.meta, generatedAt: new Date().toISOString() },
    };
    const jsonString = JSON.stringify(payloadWithTimestamp, null, 2);

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
        toast({
          title: "JSON copiado",
          description: "Conteúdo pronto para colar no ChatGPT ou salvar.",
        });
        return;
      }
      throw new Error("clipboard-unavailable");
    } catch (err) {
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `fechamento-${exportPayload.meta.selectedYear ?? "sem-ano"}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Download gerado",
          description: "Copiar para a área de transferência não funcionou, salvamos o arquivo.",
        });
      } catch (error) {
        console.error(error);
        toast({
          title: "Erro ao exportar",
          description: "Não foi possível gerar o JSON. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  }, [exportPayload, toast]);

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
            <div className="space-y-3">
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Mostrar valores absolutos</span>
                    <Switch
                      checked={showNumericDiffs}
                      onCheckedChange={setShowNumericDiffs}
                      className="scale-90"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Comparar diffs</span>
                    <select
                      value={diffViewMode}
                      onChange={(event) => setDiffViewMode(event.currentTarget.value as DiffViewMode)}
                      className="h-8 rounded-md border bg-background px-2 text-xs shadow-sm focus-visible:border-foreground"
                    >
                      {DIFF_VIEW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={handleExportJson}
                  disabled={!hasData}
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  Exportar JSON
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Fechamentos de {selectedYear ?? "—"}</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {hasData ? (
                <p className="text-xs text-muted-foreground">
                  {monthsWithData.length} {monthsWithData.length === 1 ? "mês preenchido" : "meses preenchidos"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum fechamento salvo para este ano.</p>
              )}
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
                diffViewMode={diffViewMode}
              />
              <Separator className="my-4" />
              <MetricsTable
                metrics={MAIN_METRICS}
                monthlyData={monthlyData}
                getDiffs={getDiffs}
                showNumeric={showNumericDiffs}
                diffViewMode={diffViewMode}
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
  diffViewMode,
}: {
  metrics: MetricRow[];
  monthlyData: Record<number, NormalizedMonthlyClose | null>;
  getDiffs: (month: number, metric: MetricRow) => { prevMonth: number | null; prevYear: number | null; prevMonthBase: number | null; prevYearBase: number | null };
  showNumeric: boolean;
  diffViewMode: DiffViewMode;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1200px]">
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
            <TableHead className="text-center">Total / Média</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((row) => {
            const isMargem = row.key === "margemContrib";
            const isResultado = row.key === "resultadoLiquido";
            const totals = calculateMetricTotals(row, monthlyData);
            return (
              <TableRow key={row.key}>
                <TableCell className={`bg-background sticky left-0 z-10 text-sm ${isMargem || isResultado ? "font-semibold" : ""}`}>
                  {row.label}
                </TableCell>
                {MONTH_OPTIONS.map((month) => {
                  const close = monthlyData[month.value];
                  const rawValue = row.getValue(close);
                  const { prevMonth, prevYear, prevMonthBase, prevYearBase } = getDiffs(month.value, row);
                  const inlinePercent = inlinePercentForRow(row.key, month.value, monthlyData);
                  const isCobertura = row.key === "coberturaPe";
                  const isMargemRow = row.key === "margemContrib";
                  const isResultadoRow = row.key === "resultadoLiquido";
                  const isHighlightRow = isMargemRow || isResultadoRow;
                  const numericValue = getNumericValue(rawValue, row.kind);
                  const isNegativeResult = isResultadoRow && numericValue != null && numericValue < 0;
                  const marginStatus = isMargemRow ? getMarginContribStatus(inlinePercent) : null;
                  const valueTone = isMargemRow && marginStatus
                    ? marginStatus.valueTone
                    : isNegativeResult
                      ? "text-red-600"
                      : "text-foreground";
                  const shouldShowPrevMonth = diffViewMode === "both" || diffViewMode === "prevMonth";
                  const shouldShowPrevYear = diffViewMode === "both" || diffViewMode === "prevYear";
                  const showDiffs = (!inlinePercent || isResultadoRow) && !isCobertura && !isMargemRow && (shouldShowPrevMonth || shouldShowPrevYear);
                  const invertTone = ["custoVariavel", "custoFixo", "pontoEquilibrio"].includes(row.key);
                  const displayValue = row.kind === "percent" && inlinePercent != null
                    ? `${inlinePercent.toFixed(2)}%`
                    : formatCellValue(rawValue, row.kind);
                  const showInlinePercentBelow = inlinePercent != null && row.kind !== "percent" && (isMargemRow || isResultadoRow);
                  return (
                    <TableCell
                      key={`${row.key}-${month.value}`}
                      className="text-right"
                    >
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${valueTone} ${isHighlightRow ? "font-semibold" : "font-medium"}`}>
                            {displayValue}
                          </span>
                          {!showInlinePercentBelow && !isMargemRow && inlinePercent != null && row.kind !== "percent" && (
                            <span className={`text-[11px] text-muted-foreground ${isHighlightRow ? "font-semibold" : ""}`}>
                              {inlinePercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        {showInlinePercentBelow && (
                          <span className={`text-sm font-semibold font-mono leading-tight ${isMargemRow && marginStatus ? marginStatus.valueTone : valueTone}`}>
                            {inlinePercent.toFixed(2)}%
                          </span>
                        )}
                        {isMargemRow && marginStatus?.note && (
                          <span className={`text-[11px] text-right leading-snug ${marginStatus.noteTone}`}>
                            {marginStatus.note}
                          </span>
                        )}
                        {showDiffs && (
                          <div className="flex flex-col items-end gap-1 text-[11px]">
                            {shouldShowPrevMonth && (
                              <DiffPill diff={prevMonth} base={prevMonthBase} kind={row.kind} invert={invertTone} showNumeric={showNumeric} />
                            )}
                            {shouldShowPrevYear && (
                              <DiffPill diff={prevYear} base={prevYearBase} kind={row.kind} invert={invertTone} showNumeric={showNumeric} />
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right" key={`${row.key}-totals`}>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-mono ${isMargem || isResultado ? "font-semibold" : "font-medium"} ${isResultado && totals.total != null && totals.total < 0 ? "text-red-600" : "text-foreground"}`}>
                      {formatCellValue(totals.total, row.kind)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Média: {totals.average != null
                        ? (row.kind === "percent" ? `${totals.average.toFixed(2)}%` : formatMoneyString(totals.average, 2))
                        : "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Média 3m: {totals.lastThreeAverage != null
                        ? (row.kind === "percent" ? `${totals.lastThreeAverage.toFixed(2)}%` : formatMoneyString(totals.lastThreeAverage, 2))
                        : "—"}
                    </span>
                  </div>
                </TableCell>
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
  // Use absolute base to avoid flipping the sign when comparing with a negative prior value (e.g. -2k -> +7k).
  const percentChange = base != null && base !== 0 ? (diff / Math.abs(base)) * 100 : null;
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

type MetricTotals = {
  total: number | null;
  average: number | null;
  lastThreeAverage: number | null;
};

function inlinePercentForRow(
  rowKey: string,
  month: number,
  data: Record<number, NormalizedMonthlyClose | null>,
): number | null {
  const close = data[month];
  if (!close) return null;
  if (rowKey === "margemContrib") return close.margemContribPerc ?? null;
  if (rowKey === "resultadoLiquido") return close.resultadoLiquidoPercBruta ?? null;
  if (rowKey === "coberturaPe") return close.pontoEquilibrio > 0 ? (close.receitaBruta / close.pontoEquilibrio) * 100 : null;
  return null;
}

function calculateMetricTotals(
  row: MetricRow,
  monthlyData: Record<number, NormalizedMonthlyClose | null>,
): MetricTotals {
  let total = 0;
  let count = 0;
  let hasValue = false;
  const valuesForAverage: number[] = [];

  MONTH_OPTIONS.forEach((month) => {
    const inlinePercent = inlinePercentForRow(row.key, month.value, monthlyData);
    const rawValue = row.getValue(monthlyData[month.value]);
    const value = row.kind === "percent"
      ? inlinePercent ?? getNumericValue(rawValue, row.kind)
      : getNumericValue(rawValue, row.kind);

    if (value == null) return;
    hasValue = true;
    total += value;
    if (value !== 0) count += 1;
    if (value !== 0) valuesForAverage.push(value);
  });

  const recentValues = valuesForAverage.slice(-3);
  const recentAverage = recentValues.length > 0
    ? recentValues.reduce((acc, val) => acc + val, 0) / recentValues.length
    : null;

  return {
    total: hasValue ? total : null,
    average: count > 0 ? total / count : null,
    lastThreeAverage: recentAverage,
  };
}
