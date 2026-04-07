// Shared UI primitives, formatters and types for dashboard routes.
// Used by admin.dashboard.faturamento.tsx and admin.dashboard.custos.tsx.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { WeekdayChart, TrendPoint } from "~/domain/dashboard/kpi-loader.server";

// ─── formatters ───────────────────────────────────────────────────────────────

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtCost(v: number | null, unit: string | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${unit ? `/${unit}` : ""}`;
}
export function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function fmtPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
export function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
export function varBadgeClass(pct: number) {
  if (pct >= 10) return "border-red-200 bg-red-50 text-red-700";
  if (pct >= 3) return "border-amber-200 bg-amber-50 text-amber-700";
  if (pct > -3) return "border-slate-200 bg-slate-50 text-slate-700";
  if (pct > -10) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-emerald-300 bg-emerald-100 text-emerald-800";
}

// ─── SVG chart constants ──────────────────────────────────────────────────────

export const CW = 360;
export const PX = 12;
export const PY = 16;
export const SERIES_COLORS = ["#0f172a", "#3b82f6", "#94a3b8"];
export const VISIBLE = 5;

export function buildPath(pts: Array<{ x: number; y: number }>) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

export function scalePts(values: number[], h: number) {
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

// ─── SVG charts ───────────────────────────────────────────────────────────────

export function LineAreaChart({ data, labels, title, h = 120 }: { data: number[]; labels: string[]; title: string; h?: number }) {
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

export function MultiLineChart({ series, xLabels, h = 120, yMin, yMax }: { series: Array<{ label: string; data: number[] }>; xLabels: string[]; h?: number; yMin?: number; yMax?: number }) {
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

// ─── shared UI pieces ─────────────────────────────────────────────────────────

export function ChartHeader({ title, subtitle, unit, onExpand }: { title: string; subtitle?: string; unit?: string; onExpand: () => void }) {
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

export function ShowMore({ expanded, total, visible, onClick }: { expanded: boolean; total: number; visible: number; onClick: () => void }) {
  if (total <= visible) return null;
  return (
    <button onClick={onClick} className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors border-t border-slate-100">
      {expanded ? "Ver menos ↑" : `Ver mais ${total - visible} itens ↓`}
    </button>
  );
}

// ─── skeleton placeholders ────────────────────────────────────────────────────

export function PulseLine({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-slate-100 rounded animate-pulse`} />;
}

export function ChartCardSkeleton() {
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

export function TableCardSkeleton({ rows = 5 }: { rows?: number }) {
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

// ─── AI prompt modal ──────────────────────────────────────────────────────────

export function AiPromptModal({ title, prompt, onClose }: { title: string; prompt: string; onClose: () => void }) {
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

export function AiPromptButton({ onClick }: { onClick: () => void }) {
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

// ─── error boundary for deferred sections ────────────────────────────────────

export function SectionError({ label }: { label: string }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <p className="text-xs text-red-500">Erro ao carregar {label}. Recarregue a página.</p>
      </CardContent>
    </Card>
  );
}

// ─── modal types ──────────────────────────────────────────────────────────────

export type MonthlyChartModal = {
  type: "monthly";
  values: number[];
  labels: string[];
  breakdown: Array<{ monthKey: string; label: string; total: number; isCurrent: boolean }>;
};
export type WeekdayChartModal = { type: "weekday"; chart: WeekdayChart };
export type ChartModal = MonthlyChartModal | WeekdayChartModal;

export type TrendModal = {
  title: string;
  consumptionUm: string | null;
  trend: TrendPoint[];
  latestCost: number | null;
  avgCost: number | null;
  avgSamples?: number;
};
