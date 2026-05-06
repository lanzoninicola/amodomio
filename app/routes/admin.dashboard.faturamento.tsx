import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { loadRevenueGroupData } from "~/domain/dashboard/kpi-loader.server";
import type { WeekdayChart } from "~/domain/dashboard/kpi-loader.server";
import {
  fmtBRL,
  MultiLineChart,
  LineAreaChart,
  ChartHeader,
  AiPromptModal,
  AiPromptButton,
  ChartCardSkeleton,
  SectionError,
  type MonthlyChartModal,
  type ChartModal,
} from "~/domain/dashboard/dashboard-ui";

// ─── loader ───────────────────────────────────────────────────────────────────

export async function loader() {
  return defer({ revenueData: loadRevenueGroupData() });
}

// ─── WeekdayChartCard ────────────────────────────────────────────────────────

function WeekdayChartCard({ chart, onExpand }: { chart: WeekdayChart; onExpand: () => void }) {
  const [open, setOpen] = useState(false);

  const explanation = (() => {
    const current = chart.series[0];
    const previous = chart.series.slice(1);
    if (!current || current.points.length === 0) return null;

    const fmtBRLs = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
    const fmtPct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    const sorted = [...current.points].sort((a, b) => b.total - a.total);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const first = current.points[0];
    const last = current.points[current.points.length - 1];
    const internalTrend = first.total > 0
      ? ((last.total - first.total) / first.total) * 100
      : null;

    const avgCurrent = current.points.reduce((s, p) => s + p.total, 0) / current.points.length;
    const prev = previous[0];
    const avgPrev = prev && prev.points.length > 0
      ? prev.points.reduce((s, p) => s + p.total, 0) / prev.points.length
      : null;
    const vsLast = avgPrev != null && avgPrev > 0
      ? ((avgCurrent - avgPrev) / avgPrev) * 100
      : null;

    const trendText = internalTrend != null
      ? internalTrend > 5
        ? `Dentro de ${current.seriesLabel}, o dia está em tendência de alta ao longo do mês (${fmtPct1(internalTrend)} da 1ª para a última semana).`
        : internalTrend < -5
        ? `Dentro de ${current.seriesLabel}, o dia está em tendência de queda ao longo do mês (${fmtPct1(internalTrend)} da 1ª para a última semana).`
        : `Dentro de ${current.seriesLabel}, o desempenho está relativamente estável ao longo das semanas.`
      : null;

    const vsLastText = vsLast != null
      ? `Comparado a ${prev!.seriesLabel}, a média por semana está ${vsLast >= 0 ? "acima" : "abaixo"} em ${fmtPct1(vsLast)}.`
      : null;

    return { best, worst, trendText, vsLastText, fmtBRLs, current };
  })();

  return (
    <>
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between mb-0">
            <ChartHeader
              title={chart.label}
              subtitle="Por semana do mês"
              onExpand={onExpand}
            />
            <button
              onClick={() => setOpen(true)}
              className="text-slate-300 hover:text-slate-500 transition-colors mt-0.5 ml-1 flex-shrink-0"
              title="Entender este gráfico"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                <path d="M6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <MultiLineChart
            series={chart.series.map(s => ({ label: s.seriesLabel, data: s.points.map(p => p.total) }))}
            xLabels={chart.xLabels}
          />
        </CardContent>
      </Card>

      {open && explanation && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                {chart.label} — o que o gráfico mostra
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-600 space-y-3">
              {explanation.trendText && <p>{explanation.trendText}</p>}
              {explanation.vsLastText && <p>{explanation.vsLastText}</p>}
              {explanation.best && explanation.worst && explanation.best !== explanation.worst && (
                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Destaques em {explanation.current.seriesLabel}</p>
                  <p>
                    <span className="text-emerald-600 font-medium">Melhor semana:</span>{" "}
                    {explanation.best.occurrence}ª — {explanation.fmtBRLs(explanation.best.total)}
                  </p>
                  <p>
                    <span className="text-red-500 font-medium">Pior semana:</span>{" "}
                    {explanation.worst.occurrence}ª — {explanation.fmtBRLs(explanation.worst.total)}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {open && !explanation && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                {chart.label}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-400">Sem dados suficientes para análise.</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── LeftColumn ───────────────────────────────────────────────────────────────

function LeftColumn({
  monthlyRevenue,
  previousYearMonthlyRevenue,
  avgProfitMarginPerc,
  weekdayCharts,
  onExpandMonthly,
  onExpandWeekday,
}: {
  monthlyRevenue: Array<{ monthKey: string; label: string; total: number; isCurrent: boolean }>;
  previousYearMonthlyRevenue: Array<{ monthKey: string; label: string; total: number }> | null;
  avgProfitMarginPerc: number | null;
  weekdayCharts: WeekdayChart[];
  onExpandMonthly: (modal: MonthlyChartModal) => void;
  onExpandWeekday: (chart: WeekdayChart) => void;
}) {
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  const currentMonth = monthlyRevenue.find(m => m.isCurrent);
  const currentRevenue = currentMonth?.total ?? 0;
  const estimatedProfit = avgProfitMarginPerc != null && currentRevenue > 0
    ? currentRevenue * (avgProfitMarginPerc / 100)
    : null;

  const chartSeries = [
    { label: "Ano atual", data: monthlyRevenue.map(m => m.total) },
    ...(previousYearMonthlyRevenue
      ? [{ label: "Ano anterior", data: previousYearMonthlyRevenue.map(m => m.total) }]
      : []),
  ];
  const chartLabels = monthlyRevenue.map(m => m.label);

  function buildRevenuePrompt() {
    const fmtN = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
    const fmtPct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    const revenueLines = monthlyRevenue.map((m, i) => {
      const ly = previousYearMonthlyRevenue?.[i];
      const yoy = ly && ly.total > 0
        ? ` (vs ano anterior: ${fmtN(ly.total)}, ${fmtPct1(((m.total - ly.total) / ly.total) * 100)})`
        : "";
      return `  - ${m.label}: ${fmtN(m.total)}${yoy}${m.isCurrent ? " ← mês atual" : ""}`;
    }).join("\n");

    const weekdayLines = weekdayCharts.map(chart => {
      const series = chart.series.map(s => {
        const vals = s.points.map(p => fmtN(p.total)).join(", ");
        return `    ${s.seriesLabel}: [${vals}]`;
      }).join("\n");
      return `  ${chart.label}:\n${series}`;
    }).join("\n");

    const profitLine = avgProfitMarginPerc != null && estimatedProfit != null
      ? `\nMargem média: ${avgProfitMarginPerc.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}% → Lucro presumido ${currentMonth?.label ?? ""}: ${fmtN(estimatedProfit)}`
      : "";

    return `Você é um consultor de negócios especializado em restaurantes e pizzarias. Analise os dados de faturamento abaixo e forneça insights práticos e ações concretas.

## DADOS DE FATURAMENTO

Faturamento mensal (últimos 3 meses):
${revenueLines}
${profitLine}

Faturamento por dia da semana (por semana do mês):
${weekdayLines}

## O QUE PRECISO

1. **Tendência geral**: o negócio está crescendo, estável ou em queda? Com base em quê?
2. **Comparação anual**: como estamos em relação ao mesmo período do ano passado?
3. **Padrões por dia da semana**: quais dias têm melhor e pior desempenho? Há semanas atípicas?
4. **3 ações práticas imediatas** que posso tomar para melhorar o faturamento no próximo mês.
5. **1 alerta** se você identificar algo preocupante nos dados.

Seja direto e objetivo. Prefiro sugestões específicas ao meu contexto a conselhos genéricos.`;
  }

  return (
    <div className="flex flex-col gap-6">

      <AiPromptButton onClick={() => setShowAiPrompt(true)} />

      {showAiPrompt && (
        <AiPromptModal
          title="Prompt — Análise de Faturamento"
          prompt={buildRevenuePrompt()}
          onClose={() => setShowAiPrompt(false)}
        />
      )}

      {/* ── Current Revenue + Estimated Profit ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Faturamento corrente</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">{currentMonth?.label ?? "Mês corrente"}</p>
            <p className="text-2xl font-bold text-slate-900">{fmtBRL(currentRevenue)}</p>
          </CardContent>
        </Card>
        {estimatedProfit != null && (
          <Card className="p-4">
            <CardContent className="p-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Lucro presumido</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
                {avgProfitMarginPerc!.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% médio
              </p>
              <p className="text-2xl font-bold text-emerald-600">{fmtBRL(estimatedProfit)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="p-4">
        <CardContent className="p-0">
          <ChartHeader
            title="Faturamento Global"
            subtitle="Últimos 3 meses (KDS)"
            onExpand={() => onExpandMonthly({ type: "monthly", values: monthlyRevenue.map(m => m.total), labels: chartLabels, breakdown: monthlyRevenue })}
          />
          <MultiLineChart series={chartSeries} xLabels={chartLabels} yMin={20000} yMax={100000} />
          <div className="mt-3 flex gap-4 flex-wrap">
            {monthlyRevenue.map(m => (
              <div key={m.monthKey}>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{m.label}</p>
                <p className={`text-sm font-semibold ${m.isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                  {fmtBRL(m.total)}
                </p>
                {previousYearMonthlyRevenue && (() => {
                  const ly = previousYearMonthlyRevenue[monthlyRevenue.indexOf(m)];
                  if (!ly || ly.total === 0) return null;
                  const delta = m.total - ly.total;
                  const pct = (delta / ly.total) * 100;
                  return (
                    <p className={`text-[10px] ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {delta >= 0 ? "+" : ""}{fmtBRL(delta)} ({pct >= 0 ? "+" : ""}{pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {weekdayCharts.filter(c => c.weekday !== 1 && c.weekday !== 2).map(chart => (
          <WeekdayChartCard key={chart.weekday} chart={chart} onExpand={() => onExpandWeekday(chart)} />
        ))}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DashboardFaturamento() {
  const { revenueData } = useLoaderData<typeof loader>();
  const [chartModal, setChartModal] = useState<ChartModal | null>(null);

  return (
    <>
      <Suspense fallback={
        <div className="flex flex-col gap-6">
          <ChartCardSkeleton />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 7 }, (_, i) => <ChartCardSkeleton key={i} />)}
          </div>
        </div>
      }>
        <Await resolve={revenueData} errorElement={<SectionError label="gráficos de faturamento" />}>
          {(data) => (
            <LeftColumn
              monthlyRevenue={data.monthlyRevenue}
              previousYearMonthlyRevenue={data.previousYearMonthlyRevenue}
              avgProfitMarginPerc={data.avgProfitMarginPerc}
              weekdayCharts={data.weekdayCharts}
              onExpandMonthly={setChartModal}
              onExpandWeekday={(chart) => setChartModal({ type: "weekday", chart })}
            />
          )}
        </Await>
      </Suspense>

      {/* ── Chart modal ── */}
      <Dialog open={chartModal !== null} onOpenChange={open => { if (!open) setChartModal(null); }}>
        <DialogContent className="max-w-2xl">
          {chartModal?.type === "monthly" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  Faturamento Global — Últimos 3 meses
                </DialogTitle>
              </DialogHeader>
              <LineAreaChart data={chartModal.values} labels={chartModal.labels} title="monthly-modal" h={200} />
              <div className="mt-2 flex gap-6">
                {chartModal.breakdown.map(m => (
                  <div key={m.monthKey}>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{m.label}</p>
                    <p className={`text-base font-semibold ${m.isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                      {fmtBRL(m.total)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
          {chartModal?.type === "weekday" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {chartModal.chart.label} — Por semana do mês
                </DialogTitle>
              </DialogHeader>
              <MultiLineChart
                series={chartModal.chart.series.map(s => ({ label: s.seriesLabel, data: s.points.map(p => p.total) }))}
                xLabels={chartModal.chart.xLabels}
                h={200}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
