import { defer } from "@remix-run/node";
import { Await, useActionData, useLoaderData, useFetcher } from "@remix-run/react";
import { Suspense, useState, useMemo, useEffect } from "react";
import type { IngredientImpactData } from "~/routes/admin.api.ingredient-impact.$itemId";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import Container from "~/components/layout/container/container";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { toast } from "~/components/ui/use-toast";
import {
  loadRevenueGroupData,
  loadItemsGroupData,
  loadCostVarGroupData,
} from "~/domain/dashboard/kpi-loader.server";
import type { TrendPoint, WeekdayChart, TopItem, ImpactItem, CostVarItem, CostVarImpactItem, MissingUmItem } from "~/domain/dashboard/kpi-loader.server";

// ─── loader — three independent deferred promises ────────────────────────────
// None of them are awaited here, so Remix streams the HTML shell immediately
// and resolves each group independently as they finish on the server.

export async function loader() {
  return defer({
    revenueData: loadRevenueGroupData(),   // KDS charts
    itemsData: loadItemsGroupData(),        // expensive + impactful items
    costVarData: loadCostVarGroupData(),    // cost variation tables
  });
}

// ─── action ───────────────────────────────────────────────────────────────────

export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "menu-item-visibility-change") {
    const id = values?.id as string;
    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));
    if (errItem) return badRequest(errItem);
    if (!item) return badRequest("Item não encontrado");
    const [err] = await tryit(menuItemPrismaEntity.update(id, { visible: !item.visible }));
    if (err) return badRequest(err);
    return ok(!item.visible ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`);
  }

  if (_action === "menu-item-activation-change") {
    const id = values?.id as string;
    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));
    if (errItem) return badRequest(errItem);
    if (!item) return badRequest("Item não encontrado");
    const [err] = await tryit(menuItemPrismaEntity.softDelete(id));
    if (err) return badRequest(err);
    return ok(!item.active ? `Sabor "${item.name}" ativado` : `Sabor "${item.name}" desativado`);
  }

  return null;
}

// ─── formatters ───────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtCost(v: number | null, unit: string | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${unit ? `/${unit}` : ""}`;
}
function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function varBadgeClass(pct: number) {
  if (pct >= 10) return "border-red-200 bg-red-50 text-red-700";
  if (pct >= 3) return "border-amber-200 bg-amber-50 text-amber-700";
  if (pct > -3) return "border-slate-200 bg-slate-50 text-slate-700";
  if (pct > -10) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-emerald-300 bg-emerald-100 text-emerald-800";
}

// ─── SVG charts ───────────────────────────────────────────────────────────────

const CW = 360;
const PX = 12;
const PY = 16;
const SERIES_COLORS = ["#0f172a", "#3b82f6", "#94a3b8"];

function buildPath(pts: Array<{ x: number; y: number }>) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function scalePts(values: number[], h: number) {
  const fin = values.filter(Number.isFinite);
  if (!fin.length) return [];
  const min = Math.min(...fin);
  const max = Math.max(...fin);
  const rng = Math.max(max - min, 1);
  return values.map((v, i) => ({
    x: PX + (i * (CW - PX * 2)) / Math.max(values.length - 1, 1),
    y: h - PY - ((v - min) / rng) * (h - PY * 2),
  }));
}

function LineAreaChart({ data, labels, title, h = 120 }: { data: number[]; labels: string[]; title: string; h?: number }) {
  const pts = scalePts(data, h);
  const gid = `g-${title.replace(/\W/g, "")}`;
  const tick = Math.max(1, Math.ceil(labels.length / 5));
  if (!pts.length)
    return <div className="flex items-center justify-center h-20 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">Sem dados</div>;
  const lp = buildPath(pts);
  const ap = `${lp} L${pts.at(-1)!.x} ${h - PY} L${pts[0].x} ${h - PY} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${CW} ${h}`} className="w-full overflow-visible" style={{ height: h }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PX} x2={CW - PX} y1={h - PY} y2={h - PY} stroke="#cbd5e1" strokeDasharray="3 4" />
        <path d={ap} fill={`url(#${gid})`} />
        <path d={lp} fill="none" stroke="#0f172a" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.8" fill="#0f172a" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        {labels.map((l, i) => i % tick === 0 || i === labels.length - 1
          ? <span key={i}>{l}</span>
          : <span key={i} className="invisible">{l}</span>)}
      </div>
    </div>
  );
}

function MultiLineChart({ series, xLabels, h = 120, yMin, yMax }: { series: Array<{ label: string; data: number[] }>; xLabels: string[]; h?: number; yMin?: number; yMax?: number }) {
  const all = series.flatMap(s => s.data).filter(Number.isFinite);
  if (!all.length)
    return <div className="flex items-center justify-center h-20 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">Sem dados</div>;
  const min = yMin !== undefined ? yMin : Math.min(...all);
  const max = yMax !== undefined ? yMax : Math.max(...all);
  const rng = Math.max(max - min, 1);
  const maxLen = Math.max(...series.map(s => s.data.length), 1);
  const pw = CW - PX * 2;
  const ph = h - PY * 2;
  const getPts = (data: number[]) => data.map((v, i) => ({
    x: PX + (i * pw) / Math.max(maxLen - 1, 1),
    y: h - PY - ((v - min) / rng) * ph,
  }));
  return (
    <div>
      <svg viewBox={`0 0 ${CW} ${h}`} className="w-full overflow-visible" style={{ height: h }}>
        <line x1={PX} x2={CW - PX} y1={h - PY} y2={h - PY} stroke="#cbd5e1" strokeDasharray="3 4" />
        {series.map((s, si) => {
          const p = getPts(s.data);
          if (!p.length) return null;
          return (
            <g key={si}>
              <path d={buildPath(p)} fill="none" stroke={SERIES_COLORS[si]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {p.map((pt, pi) => <circle key={pi} cx={pt.x} cy={pt.y} r="2.4" fill={SERIES_COLORS[si]} />)}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        {xLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
      <div className="mt-2 flex gap-3 flex-wrap">
        {series.map((s, si) => (
          <div key={si} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[si] }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── shared ui pieces ─────────────────────────────────────────────────────────

function ChartHeader({ title, subtitle, unit, onExpand }: { title: string; subtitle?: string; unit?: string; onExpand: () => void }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {unit && <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{unit}</span>}
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700" onClick={onExpand} title="Expandir gráfico">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

function ShowMore({ expanded, total, visible, onClick }: { expanded: boolean; total: number; visible: number; onClick: () => void }) {
  if (total <= visible) return null;
  return (
    <button onClick={onClick} className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors border-t border-slate-100">
      {expanded ? "Ver menos ↑" : `Ver mais ${total - visible} itens ↓`}
    </button>
  );
}

// ─── skeleton placeholders ────────────────────────────────────────────────────

function PulseLine({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-slate-100 rounded animate-pulse`} />;
}

function ChartCardSkeleton() {
  return (
    <Card className="p-4">
      <CardContent className="p-0 space-y-3">
        <PulseLine w="w-32" />
        <PulseLine w="w-48" h="h-2" />
        <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
      </CardContent>
    </Card>
  );
}

function TableCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0 space-y-3">
        <PulseLine w="w-40" />
        <PulseLine w="w-56" h="h-2" />
        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── modal types ──────────────────────────────────────────────────────────────

type MonthlyChartModal = {
  type: "monthly";
  values: number[];
  labels: string[];
  breakdown: Array<{ monthKey: string; label: string; total: number; isCurrent: boolean }>;
};
type WeekdayChartModal = { type: "weekday"; chart: WeekdayChart };
type ChartModal = MonthlyChartModal | WeekdayChartModal;

type TrendModal = {
  title: string;
  consumptionUm: string | null;
  trend: TrendPoint[];
  latestCost: number | null;
  avgCost: number | null;
  avgSamples?: number;
};

// ─── AI prompt modal ──────────────────────────────────────────────────────────

function AiPromptModal({ title, prompt, onClose }: { title: string; prompt: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Copie o prompt abaixo e cole num chat de IA (ChatGPT, Claude, Gemini etc.) para obter análise e sugestões práticas.
          </p>
          <textarea
            readOnly
            value={prompt}
            rows={16}
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 resize-none focus:outline-none"
          />
          <div className="flex justify-end">
            <Button onClick={copy} variant="outline" size="sm" className="gap-2">
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="white"/></svg>
                  Copiar prompt
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AiPromptButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-violet-600 transition-colors border border-slate-200 hover:border-violet-300 rounded-md px-3 py-1.5 bg-white hover:bg-violet-50 w-full justify-center"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1.5L9.5 5.5L13.5 7L9.5 8.5L8 12.5L6.5 8.5L2.5 7L6.5 5.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M13 11L13.7 12.3L15 13L13.7 13.7L13 15L12.3 13.7L11 13L12.3 12.3L13 11Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
      Analisar com IA
    </button>
  );
}

// ─── weekday chart card with explanation ──────────────────────────────────────

function WeekdayChartCard({ chart, onExpand }: { chart: WeekdayChart; onExpand: () => void }) {
  const [open, setOpen] = useState(false);

  const explanation = (() => {
    // current month is the first series, previous months follow
    const current = chart.series[0];
    const previous = chart.series.slice(1);
    if (!current || current.points.length === 0) return null;

    const fmtBRLs = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
    const fmtPct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    // best and worst week in current month
    const sorted = [...current.points].sort((a, b) => b.total - a.total);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // trend within current month (first vs last point)
    const first = current.points[0];
    const last = current.points[current.points.length - 1];
    const internalTrend = first.total > 0
      ? ((last.total - first.total) / first.total) * 100
      : null;

    // compare avg of current month vs avg of most recent previous series
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

// ─── left column content ──────────────────────────────────────────────────────

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

// ─── right column: items tables ───────────────────────────────────────────────

const VISIBLE = 5;

function ItemsTables({
  topExpensive,
  topImpact,
  onItemTrend,
  onImpactTrend,
}: {
  topExpensive: TopItem[];
  topImpact: ImpactItem[];
  onItemTrend: (m: TrendModal) => void;
  onImpactTrend: (m: TrendModal) => void;
}) {
  const [showAllExpensive, setShowAllExpensive] = useState(false);
  const [showAllImpact, setShowAllImpact] = useState(false);

  return (
    <>
      {/* impactful */}
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Top {topImpact.length} Insumos Mais Impactantes
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Custo acumulado nas receitas — clique para ver andamento</p>
          {topImpact.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">Sem dados de receitas.</p>
            : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-6">#</TableHead>
                      <TableHead className="text-xs">Insumo</TableHead>
                      <TableHead className="text-xs text-right">Usos</TableHead>
                      <TableHead className="text-xs text-right">Impacto total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topImpact.slice(0, showAllImpact ? topImpact.length : VISIBLE).map((item, i) => (
                      <TableRow
                        key={item.itemId}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => onImpactTrend({
                          title: item.name,
                          consumptionUm: item.consumptionUm,
                          trend: item.trend,
                          latestCost: item.latestCostPerConsumptionUnit,
                          avgCost: null,
                        })}
                      >
                        <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs text-right text-slate-500">{item.recipeUsageCount}x</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtMoney(item.totalCostImpact)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ShowMore expanded={showAllImpact} total={topImpact.length} visible={VISIBLE} onClick={() => setShowAllImpact(v => !v)} />
              </>
            )}
        </CardContent>
      </Card>

      {/* expensive */}
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Top {topExpensive.length} Insumos Mais Caros
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Clique para ver o andamento de custo</p>
          {topExpensive.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">Sem dados de custo.</p>
            : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-6">#</TableHead>
                      <TableHead className="text-xs">Insumo</TableHead>
                      <TableHead className="text-xs text-right">Custo médio</TableHead>
                      <TableHead className="text-xs text-right">Custo atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topExpensive.slice(0, showAllExpensive ? topExpensive.length : VISIBLE).map((item, i) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => onItemTrend({
                          title: item.name,
                          consumptionUm: item.consumptionUm,
                          trend: item.trend,
                          latestCost: item.latestCostPerConsumptionUnit,
                          avgCost: item.averageCostPerConsumptionUnit,
                          avgSamples: item.averageSamplesCount,
                        })}
                      >
                        <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtCost(item.averageCostPerConsumptionUnit, item.consumptionUm)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtCost(item.latestCostPerConsumptionUnit, item.consumptionUm)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ShowMore expanded={showAllExpensive} total={topExpensive.length} visible={VISIBLE} onClick={() => setShowAllExpensive(v => !v)} />
              </>
            )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── data quality alert ───────────────────────────────────────────────────────

function MissingConsumptionUmAlert({ items }: { items: MissingUmItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-600">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">
            {items.length} {items.length === 1 ? "insumo sem" : "insumos sem"} unidade de consumo (consumptionUm)
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Esses itens têm entradas de custo em unidades diferentes mas sem conversão definida — a variação não pode ser calculada corretamente. Acesse cada item e configure a unidade de consumo.
          </p>
          <ul className="mt-2 space-y-1">
            {visible.map(item => (
              <li key={item.itemId} className="flex items-center gap-2 text-[11px]">
                <a
                  href={`/admin/items/${item.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber-900 hover:underline"
                >
                  {item.name}
                </a>
                <span className="text-amber-600">
                  ({item.previousUnit ?? "—"} → {item.latestUnit ?? "—"})
                </span>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[11px] font-medium text-amber-700 hover:underline"
            >
              {expanded ? "Ver menos ↑" : `Ver mais ${items.length - 3} ↓`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ingredient impact modal ──────────────────────────────────────────────────

function ImpactIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IngredientImpactModal({
  item,
  data,
  loading,
  onClose,
}: {
  item: CostVarItem;
  data: IngredientImpactData | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  // Collect all unique size variations across all recipes
  const allVariations = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; kind: string | null }> = [];
    for (const recipe of data.recipes) {
      for (const v of recipe.variations) {
        if (!seen.has(v.variationId)) {
          seen.add(v.variationId);
          result.push({ id: v.variationId, name: v.variationName, kind: v.variationKind });
        }
      }
    }
    // Sort: "tamanho" variations first, then alphabetically
    return result.sort((a, b) => {
      if (a.kind === "tamanho" && b.kind !== "tamanho") return -1;
      if (b.kind === "tamanho" && a.kind !== "tamanho") return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [data]);

  // Default to "tamanho medio" (name contains "médi"/"media")
  const defaultId = useMemo(() => {
    const medio = allVariations.find(v =>
      /médi/i.test(v.name) || /media/i.test(v.name) || /médio/i.test(v.name)
    );
    return medio?.id ?? allVariations[0]?.id ?? null;
  }, [allVariations]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset selection when the item changes (new modal open)
  useEffect(() => { setSelectedId(null); }, [item.itemId]);

  const effectiveId = selectedId ?? defaultId;

  // Filter recipes to only those that have the selected variation
  const filteredRecipes = useMemo(
    () =>
      (data?.recipes ?? [])
        .map(recipe => ({
          ...recipe,
          variation: recipe.variations.find(v => v.variationId === effectiveId),
        }))
        .filter(r => r.variation != null),
    [data, effectiveId]
  );

  const totalBefore = filteredRecipes.reduce((s, r) => s + (r.variation?.costBefore ?? 0), 0);
  const totalAfter = filteredRecipes.reduce((s, r) => s + (r.variation?.costAfter ?? 0), 0);
  const totalDelta = totalAfter - totalBefore;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Impacto nas Receitas — {item.name}
          </DialogTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fmtMoney(item.previous)} → {fmtMoney(item.current)}
            <span className={`ml-2 font-medium ${item.absDelta > 0 ? "text-red-600" : "text-emerald-600"}`}>
              ({item.absDelta > 0 ? "+" : ""}{fmtMoney(item.absDelta)})
            </span>
          </p>
        </DialogHeader>

        {/* Variation filter pills */}
        {allVariations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 pb-2 border-b border-slate-100">
            {allVariations.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  effectiveId === v.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          )}

          {!loading && filteredRecipes.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              {allVariations.length === 0
                ? "Nenhuma receita usa este insumo com dados de variação."
                : "Nenhuma receita encontrada para o tamanho selecionado."}
            </p>
          )}

          {!loading && filteredRecipes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-6">#</TableHead>
                  <TableHead className="text-xs">Receita</TableHead>
                  <TableHead className="text-xs text-right">Qtd.</TableHead>
                  <TableHead className="text-xs text-right">Antes</TableHead>
                  <TableHead className="text-xs text-right">Depois</TableHead>
                  <TableHead className="text-xs text-right">Δ R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes.map((r, i) => {
                  const v = r.variation!;
                  return (
                    <TableRow key={r.recipeId} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{r.recipeName}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-slate-500">
                        {v.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                        {v.unit ? ` ${v.unit}` : ""}
                        {v.lossPct > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400">({v.lossPct}%↓)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-slate-500">
                        {fmtMoney(v.costBefore)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {fmtMoney(v.costAfter)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant="outline" className={varBadgeClass(v.delta / Math.max(Math.abs(v.costBefore), 0.001) * 100)}>
                          {v.delta > 0 ? "+" : ""}{fmtMoney(v.delta)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Totals footer */}
        {!loading && filteredRecipes.length > 0 && (
          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <span className="text-[11px] text-slate-500">{filteredRecipes.length} receita{filteredRecipes.length !== 1 ? "s" : ""}</span>
            <div className="flex gap-4 items-center">
              <span className="text-[11px] text-slate-400">Total antes: <span className="font-mono text-slate-600">{fmtMoney(totalBefore)}</span></span>
              <span className="text-[11px] text-slate-400">Total depois: <span className="font-mono text-slate-600">{fmtMoney(totalAfter)}</span></span>
              <Badge variant="outline" className={varBadgeClass(totalDelta / Math.max(Math.abs(totalBefore), 0.001) * 100)}>
                {totalDelta > 0 ? "+" : ""}{fmtMoney(totalDelta)}
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── net avg card ─────────────────────────────────────────────────────────────

function NetAvgCard({ netAvg, total, increased, decreased, avgIncrease, avgDecrease, latestCurrentDate }: {
  netAvg: number;
  total: number;
  increased: number;
  decreased: number;
  avgIncrease: number | null;
  avgDecrease: number | null;
  latestCurrentDate: string | null;
}) {
  const [open, setOpen] = useState(false);

  const fmt1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtSigned = (v: number) => `${v > 0 ? "+" : ""}${fmt1(v)}%`;

  const monthLabel = latestCurrentDate
    ? new Date(latestCurrentDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "este mês";

  const explanation = (() => {
    const parts: string[] = [];
    if (avgIncrease !== null) parts.push(`${increased} × ${fmtSigned(avgIncrease)}`);
    if (avgDecrease !== null) parts.push(`${decreased} × ${fmtSigned(avgDecrease)}`);
    const formula = `(${parts.join(" + ")}) ÷ ${total}`;

    const headline = netAvg > 0
      ? `Seu custo de insumos subiu ${fmt1(Math.abs(netAvg))}% em ${monthLabel} — sua margem encolheu na mesma proporção, a menos que os preços de venda tenham acompanhado.`
      : netAvg < 0
      ? `Seu custo de insumos caiu ${fmt1(Math.abs(netAvg))}% em ${monthLabel} — sua margem melhorou na mesma proporção se os preços de venda ficaram estáveis.`
      : `As variações se equilibraram em ${monthLabel} — o custo médio dos insumos ficou praticamente estável.`;

    const actions: string[] = netAvg > 0 ? [
      `Verifique os ${increased} insumos que subiram e priorize os que têm mais receitas dependentes (veja a tabela "Por Impacto").`,
      `Avalie reajuste de preço nos itens do cardápio que usam os insumos mais afetados.`,
      `Pesquise fornecedores alternativos para os insumos com maior variação positiva.`,
      `Se o aumento for pontual (sazonalidade), considere substituição temporária de ingredientes.`,
    ] : netAvg < 0 ? [
      `Aproveite a queda para revisar os preços de venda — a margem extra pode ser reinvestida ou retida.`,
      `Verifique se a queda é estrutural (mudança de fornecedor) ou pontual (promoção/sazonalidade) antes de tomar decisões de médio prazo.`,
      `Monitore os ${increased} insumos que ainda subiram — eles podem pressionar a margem nos próximos meses.`,
    ] : [
      `Equilíbrio saudável — monitore os ${increased} insumos que subiram para garantir que não se agravem no próximo mês.`,
    ];

    return { formula, headline, actions };
  })();

  return (
    <>
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Saldo geral</p>
            <button
              onClick={() => setOpen(true)}
              className="text-slate-300 hover:text-slate-500 transition-colors -mt-0.5"
              title="Como é calculado?"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                <path d="M6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
            {total} insumos — {monthLabel.toUpperCase()}
          </p>
          <p className={`text-2xl font-bold ${netAvg > 0 ? "text-red-600" : netAvg < 0 ? "text-emerald-600" : "text-slate-700"}`}>
            {fmtSigned(netAvg)}
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              O que esse número significa?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-4">
            {/* 1. impacto direto — o mais importante */}
            <p className={`font-medium ${netAvg > 0 ? "text-red-700" : netAvg < 0 ? "text-emerald-700" : "text-slate-700"}`}>
              {explanation.headline}
            </p>

            {/* 2. ações concretas */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">O que fazer agora</p>
              <ul className="space-y-1.5">
                {explanation.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600">
                    <span className="text-slate-300 mt-0.5">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. como é calculado — detalhe técnico por último */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Como é calculado</p>
              <p className="text-xs text-slate-400 mb-1">Média da variação % de todos os {total} insumos (alta e queda):</p>
              <p className="font-mono text-xs bg-slate-50 rounded px-3 py-2 text-slate-500">
                {explanation.formula} ≈ {fmtSigned(netAvg)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── right column: cost variation tables ─────────────────────────────────────

function CostVarTables({ byAbs, byPct, byImpact, missingConsumptionUm, all }: { byAbs: CostVarItem[]; byPct: CostVarItem[]; byImpact: CostVarImpactItem[]; missingConsumptionUm: MissingUmItem[]; all: CostVarItem[] }) {
  const [showAllAbs, setShowAllAbs] = useState(false);
  const [showAllPct, setShowAllPct] = useState(false);
  const [showAllImpact, setShowAllImpact] = useState(false);

  // ── recipe impact modal state ──
  const [impactModal, setImpactModal] = useState<CostVarItem | null>(null);
  const impactFetcher = useFetcher<IngredientImpactData>();

  function openImpact(item: CostVarItem) {
    setImpactModal(item);
    impactFetcher.load(
      `/admin/api/ingredient-impact/${item.itemId}?previous=${item.previous}&current=${item.current}`
    );
  }

  // ── shared cell helpers ──
  function impactBtn(item: CostVarItem) {
    return (
      <TableCell className="w-7 px-1">
        <button
          title="Ver impacto nas receitas"
          onClick={e => { e.stopPropagation(); openImpact(item); }}
          className="text-slate-300 hover:text-slate-600 transition-colors"
        >
          <ImpactIcon />
        </button>
      </TableCell>
    );
  }

  function prevCell(item: CostVarItem) {
    return (
      <TableCell className="text-xs text-right font-mono text-slate-500">
        <div>{fmtMoney(item.previous)}</div>
        {fmtDateShort(item.previousDate) && <div className="text-[10px] text-slate-400">{fmtDateShort(item.previousDate)}</div>}
      </TableCell>
    );
  }

  function currCell(item: CostVarItem) {
    return (
      <TableCell className="text-xs text-right font-mono">
        <div>{fmtMoney(item.current)}</div>
        {fmtDateShort(item.currentDate) && <div className="text-[10px] text-slate-400">{fmtDateShort(item.currentDate)}</div>}
      </TableCell>
    );
  }

  // ── varTable helper ──
  const varTable = (
    items: CostVarItem[],
    showAll: boolean,
    toggle: () => void,
    mode: "abs" | "pct",
  ) => (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
          Variação de Custo — {mode === "abs" ? "Por Valor Absoluto" : "Por Percentual"}
        </p>
        <p className="text-[11px] text-slate-400 mb-3">
          Top {items.length} maiores variações {mode === "abs" ? "em R$" : "em %"}
        </p>
        {items.length === 0
          ? <p className="text-sm text-slate-400 py-4 text-center">Sem variações registradas.</p>
          : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs w-6">#</TableHead>
                    <TableHead className="text-xs">Insumo</TableHead>
                    <TableHead className="text-xs text-right">Antes</TableHead>
                    <TableHead className="text-xs text-right">Depois</TableHead>
                    <TableHead className="text-xs text-right">{mode === "abs" ? "Δ R$" : "Δ %"}</TableHead>
                    <TableHead className="w-7" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, showAll ? items.length : VISIBLE).map((item, i) => (
                    <TableRow key={`${item.itemId}-${i}`} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">
                        <a
                          href={`/admin/items/${item.itemId}/stock-movements`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-blue-600 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {item.name}
                        </a>
                      </TableCell>
                      {prevCell(item)}
                      {currCell(item)}
                      <TableCell className="text-xs text-right">
                        <Badge variant="outline" className={varBadgeClass(item.pctDelta)}>
                          {mode === "abs"
                            ? `${item.absDelta > 0 ? "+" : ""}${fmtMoney(item.absDelta)}`
                            : fmtPct(item.pctDelta)}
                        </Badge>
                      </TableCell>
                      {impactBtn(item)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ShowMore expanded={showAll} total={items.length} visible={VISIBLE} onClick={toggle} />
            </>
          )}
      </CardContent>
    </Card>
  );

  const [showCostAiPrompt, setShowCostAiPrompt] = useState(false);

  // ── monthly cost variation summary ──
  const increased = all.filter(i => i.pctDelta > 0);
  const decreased = all.filter(i => i.pctDelta < 0);
  const avgIncrease = increased.length > 0
    ? increased.reduce((s, i) => s + i.pctDelta, 0) / increased.length
    : null;
  const avgDecrease = decreased.length > 0
    ? decreased.reduce((s, i) => s + i.pctDelta, 0) / decreased.length
    : null;
  const netAvg = all.length > 0
    ? all.reduce((s, i) => s + i.pctDelta, 0) / all.length
    : null;
  const latestCurrentDate = all
    .map(i => i.currentDate)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  function buildCostPrompt() {
    const fmtPct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    const fmtBRLm = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthRef = latestCurrentDate
      ? new Date(latestCurrentDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : "mês corrente";

    const sortedUp = [...increased].sort((a, b) => b.pctDelta - a.pctDelta);
    const sortedDown = [...decreased].sort((a, b) => a.pctDelta - b.pctDelta);

    const upLines = sortedUp.map(i =>
      `  - ${i.name}: ${fmtBRLm(i.previous)} → ${fmtBRLm(i.current)} (${fmtPct1(i.pctDelta)})`
    ).join("\n");
    const downLines = sortedDown.map(i =>
      `  - ${i.name}: ${fmtBRLm(i.previous)} → ${fmtBRLm(i.current)} (${fmtPct1(i.pctDelta)})`
    ).join("\n");

    const impactLines = byImpact.slice(0, 5).map(i =>
      `  - ${i.name}: ${i.recipeUsageCount} receita${i.recipeUsageCount !== 1 ? "s" : ""} afetada${i.recipeUsageCount !== 1 ? "s" : ""}, variação ${fmtPct1(i.pctDelta)}`
    ).join("\n");

    const netLine = netAvg != null
      ? `Variação líquida média (todos os insumos): ${fmtPct1(netAvg)}`
      : "";

    return `Você é um consultor de negócios especializado em restaurantes e pizzarias. Analise os dados de variação de custo de insumos abaixo e forneça recomendações práticas.

## DADOS DE CUSTO DE INSUMOS — ${monthRef.toUpperCase()}

${netLine}

Insumos que SUBIRAM de preço (${increased.length} no total):
${upLines || "  (nenhum)"}

Insumos que CAÍRAM de preço (${decreased.length} no total):
${downLines || "  (nenhum)"}

Top insumos por IMPACTO NAS RECEITAS (usados em mais pratos):
${impactLines || "  (sem dados)"}

## O QUE PRECISO

1. **Prioridade imediata**: quais insumos merecem atenção urgente e por quê?
2. **Impacto na margem**: com base nos insumos mais usados em receitas, como isso afeta meu lucro?
3. **Ações de curto prazo** (próximas 2 semanas):
   - Negociação com fornecedores: quais e como abordar?
   - Substituição de ingredientes: onde é viável sem impactar qualidade?
   - Ajuste de cardápio: algum item merece revisão de preço ou descontinuação?
4. **1 oportunidade** que você enxerga nos insumos que caíram de preço.
5. **Alerta** caso identifique algo preocupante no padrão de variação.

Seja direto e objetivo. Prefiro sugestões específicas ao meu contexto a conselhos genéricos.`;
  }

  return (
    <>
      <MissingConsumptionUmAlert items={missingConsumptionUm} />

      <AiPromptButton onClick={() => setShowCostAiPrompt(true)} />

      {showCostAiPrompt && (
        <AiPromptModal
          title="Prompt — Análise de Custos de Insumos"
          prompt={buildCostPrompt()}
          onClose={() => setShowCostAiPrompt(false)}
        />
      )}

      {/* Monthly cost variation summary */}
      {(avgIncrease !== null || avgDecrease !== null) && (
        <div className="grid grid-cols-3 gap-4">
          {avgIncrease !== null && (
            <Card className="p-4">
              <CardContent className="p-0">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Insumos com alta</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
                  {increased.length} insumo{increased.length !== 1 ? "s" : ""} — variação média
                </p>
                <p className="text-2xl font-bold text-red-600">
                  +{avgIncrease.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </p>
              </CardContent>
            </Card>
          )}
          {avgDecrease !== null && (
            <Card className="p-4">
              <CardContent className="p-0">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Insumos com queda</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
                  {decreased.length} insumo{decreased.length !== 1 ? "s" : ""} — variação média
                </p>
                <p className="text-2xl font-bold text-emerald-600">
                  {avgDecrease.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </p>
              </CardContent>
            </Card>
          )}
          {netAvg !== null && (
            <NetAvgCard
              netAvg={netAvg}
              total={all.length}
              increased={increased.length}
              decreased={decreased.length}
              avgIncrease={avgIncrease}
              avgDecrease={avgDecrease}
              latestCurrentDate={latestCurrentDate}
            />
          )}
        </div>
      )}

      {/* Impact-weighted table */}
      {byImpact.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
              Variação de Custo — Por Impacto nas Receitas
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Top {byImpact.length} — variação ponderada pelo número de receitas que usam o insumo
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-6">#</TableHead>
                  <TableHead className="text-xs">Insumo</TableHead>
                  <TableHead className="text-xs text-right">Usos</TableHead>
                  <TableHead className="text-xs text-right">Antes</TableHead>
                  <TableHead className="text-xs text-right">Depois</TableHead>
                  <TableHead className="text-xs text-right">Δ R$</TableHead>
                  <TableHead className="w-7" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {byImpact.slice(0, showAllImpact ? byImpact.length : VISIBLE).map((item, i) => (
                  <TableRow key={`${item.itemId}-${i}`} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <a
                        href={`/admin/items/${item.itemId}/stock-movements`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-600 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {item.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-500">{item.recipeUsageCount}x</TableCell>
                    {prevCell(item)}
                    {currCell(item)}
                    <TableCell className="text-xs text-right">
                      <Badge variant="outline" className={varBadgeClass(item.pctDelta)}>
                        {item.absDelta > 0 ? "+" : ""}{fmtMoney(item.absDelta)}
                      </Badge>
                    </TableCell>
                    {impactBtn(item)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ShowMore expanded={showAllImpact} total={byImpact.length} visible={VISIBLE} onClick={() => setShowAllImpact(v => !v)} />
          </CardContent>
        </Card>
      )}

      {varTable(byAbs, showAllAbs, () => setShowAllAbs(v => !v), "abs")}
      {varTable(byPct, showAllPct, () => setShowAllPct(v => !v), "pct")}

      {/* Recipe impact modal */}
      {impactModal && (
        <IngredientImpactModal
          item={impactModal}
          data={impactFetcher.data}
          loading={impactFetcher.state === "loading"}
          onClose={() => setImpactModal(null)}
        />
      )}
    </>
  );
}

// ─── error boundary for deferred sections ────────────────────────────────────

function SectionError({ label }: { label: string }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <p className="text-xs text-red-500">Erro ao carregar {label}. Recarregue a página.</p>
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AdminIndex() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [chartModal, setChartModal] = useState<ChartModal | null>(null);
  const [trendModal, setTrendModal] = useState<TrendModal | null>(null);

  if (actionData && actionData.status > 399) toast({ title: "Erro", description: actionData.message });
  if (actionData && actionData.status === 200) toast({ title: "Ok", description: actionData.message });

  return (
    <Container className="md:max-w-none">
      <div className="py-8 px-2 md:px-4 max-w-screen-xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Performance</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN — revenue (resolves independently) ── */}
          <Suspense fallback={
            <div className="flex flex-col gap-6">
              <ChartCardSkeleton />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 7 }, (_, i) => <ChartCardSkeleton key={i} />)}
              </div>
            </div>
          }>
            <Await resolve={data.revenueData} errorElement={<SectionError label="gráficos de faturamento" />}>
              {(revenueData) => (
                <LeftColumn
                  monthlyRevenue={revenueData.monthlyRevenue}
                  previousYearMonthlyRevenue={revenueData.previousYearMonthlyRevenue}
                  avgProfitMarginPerc={revenueData.avgProfitMarginPerc}
                  weekdayCharts={revenueData.weekdayCharts}
                  onExpandMonthly={setChartModal}
                  onExpandWeekday={(chart) => setChartModal({ type: "weekday", chart })}
                />
              )}
            </Await>
          </Suspense>

          {/* ── RIGHT COLUMN ─────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* cost variation tables — first (resolves independently) */}
            <Suspense fallback={<><TableCardSkeleton /><TableCardSkeleton /><TableCardSkeleton /></>}>
              <Await resolve={data.costVarData} errorElement={<SectionError label="tabelas de variação" />}>
                {(costVarData) => (
                  <CostVarTables
                    byAbs={costVarData.byAbs}
                    byPct={costVarData.byPct}
                    byImpact={costVarData.byImpact}
                    missingConsumptionUm={costVarData.missingConsumptionUm}
                    all={costVarData.all}
                  />
                )}
              </Await>
            </Suspense>

            {/* impactful + expensive items (resolves independently) */}
            <Suspense fallback={<><TableCardSkeleton /><TableCardSkeleton /></>}>
              <Await resolve={data.itemsData} errorElement={<SectionError label="tabelas de insumos" />}>
                {(itemsData) => (
                  <ItemsTables
                    {...itemsData}
                    onItemTrend={setTrendModal}
                    onImpactTrend={setTrendModal}
                  />
                )}
              </Await>
            </Suspense>

          </div>
        </div>
      </div>

      {/* ── CHART MODAL ───────────────────────────────────────── */}
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

      {/* ── TREND MODAL ───────────────────────────────────────── */}
      <Dialog open={trendModal !== null} onOpenChange={open => { if (!open) setTrendModal(null); }}>
        <DialogContent className="max-w-2xl">
          {trendModal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {trendModal.title}
                </DialogTitle>
                <p className="text-[11px] text-slate-400">Andamento do custo — últimos 60 dias</p>
              </DialogHeader>
              <div className="mt-2">
                {trendModal.trend.length === 0
                  ? <div className="flex h-32 items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">Sem histórico suficiente.</div>
                  : (
                    <LineAreaChart
                      data={trendModal.trend.map(p => p.value)}
                      labels={trendModal.trend.map(p => p.label)}
                      title={`trend-${trendModal.title}`}
                      h={200}
                    />
                  )}
                <div className="mt-4 flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Custo atual</p>
                    <p className="text-base font-semibold text-slate-900">{fmtCost(trendModal.latestCost, trendModal.consumptionUm)}</p>
                  </div>
                  {trendModal.avgCost != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Custo médio{trendModal.avgSamples ? ` (${trendModal.avgSamples} amostras)` : ""}
                      </p>
                      <p className="text-base font-semibold text-slate-700">{fmtCost(trendModal.avgCost, trendModal.consumptionUm)}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
