import { Link, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).supplierName;
  const s = String(v || "").trim();
  return s || null;
}

function isComparisonOnly(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const r = metadata as Record<string, unknown>;
  return r.comparisonOnly === true || r.excludeFromMetrics === true;
}

function normalizeUm(v: string | null | undefined) {
  return String(v || "").trim().toUpperCase() || null;
}

function normalizeCostToConsumptionUnit(
  cost: { costAmount?: number | null; unit?: string | null; source?: string | null },
  item: { purchaseUm?: string | null; consumptionUm?: string | null; purchaseToConsumptionFactor?: number | null },
): number | null {
  const amount = Number(cost.costAmount ?? NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const costUnit = normalizeUm(cost.unit);
  const purchaseUm = normalizeUm(item.purchaseUm);
  const consumptionUm = normalizeUm(item.consumptionUm);
  const factor = Number(item.purchaseToConsumptionFactor ?? NaN);
  if (!consumptionUm) return amount;
  if (!costUnit && String(cost.source || "").trim().toLowerCase() === "item-cost-sheet") return amount;
  if (costUnit === consumptionUm) return amount;
  if (costUnit && purchaseUm && costUnit === purchaseUm && Number.isFinite(factor) && factor > 0) return amount / factor;
  return null;
}

function toValidDate(value: unknown): Date | null {
  const d = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function AdminItemCostsIndex() {
  const { item, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();

  const history: any[] = item._itemCostVariationHistory || [];
  const referenceUnit = item.consumptionUm || item.purchaseUm || costMetrics?.latestCost?.unit || "";
  const latestSupplierName =
    history.map((r: any) => getSupplierNameFromMetadata(r?.metadata)).find(Boolean) || "";

  // Build sparkline from history
  const chartMap = new Map<string, { date: string; label: string; total: number; count: number }>();
  for (const row of history) {
    if (isComparisonOnly(row?.metadata)) continue;
    const date = toValidDate(row?.validFrom) || toValidDate(row?.createdAt);
    if (!date) continue;
    const amount = normalizeCostToConsumptionUnit(row, item);
    if (!Number.isFinite(amount) || (amount as number) < 0) continue;
    const key = date.toISOString().slice(0, 10);
    const bucket = chartMap.get(key) || {
      date: key,
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: 0,
      count: 0,
    };
    bucket.total += amount as number;
    bucket.count += 1;
    chartMap.set(key, bucket);
  }
  const chartData = Array.from(chartMap.values())
    .map((b) => ({ ...b, value: b.count > 0 ? b.total / b.count : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const chartMax = Math.max(...chartData.map((b) => b.value), 0);

  const basePath = `/admin/items/${item.id}/costs`;

  const svgW = 600;
  const svgH = 180;
  const padL = 56;
  const padR = 56;
  const padT = 32;
  const padB = 32;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;
  const pts = chartData.map((b, i) => ({
    x: padL + (chartData.length > 1 ? (i / (chartData.length - 1)) * innerW : innerW / 2),
    y: padT + (chartMax > 0 ? (1 - b.value / chartMax) * innerH : innerH / 2),
    ...b,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    : "";
  const step = Math.max(1, Math.ceil(pts.length / 6));
  const COMPACT = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid gap-4 lg:grid-cols-2">

      {/* Coluna esquerda — KPIs + atalhos */}
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último custo</div>
          <div className="text-2xl font-bold text-slate-900">
            {costMetrics?.latestCostPerConsumptionUnit != null
              ? BRL.format(Number(costMetrics.latestCostPerConsumptionUnit))
              : <span className="text-base font-normal text-slate-400">não informado</span>}
          </div>
          {referenceUnit && <div className="text-xs text-slate-400">por {referenceUnit}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Custo médio ({averageWindowDays}d)
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {costMetrics?.averageCostPerConsumptionUnit != null
              ? BRL.format(Number(costMetrics.averageCostPerConsumptionUnit))
              : <span className="text-base font-normal text-slate-400">não informado</span>}
          </div>
          {referenceUnit && <div className="text-xs text-slate-400">por {referenceUnit}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último fornecedor</div>
          <div className="text-sm font-semibold text-slate-900 truncate">
            {latestSupplierName || <span className="font-normal text-slate-400">não informado</span>}
          </div>
          {item.purchaseUm && item.consumptionUm && item.purchaseToConsumptionFactor ? (
            <div className="text-xs text-slate-400">
              1 {item.purchaseUm} = {Number(item.purchaseToConsumptionFactor).toFixed(6)} {item.consumptionUm}
            </div>
          ) : (
            <div className="text-xs text-amber-600">Conversão de unidades não configurada</div>
          )}
        </div>

        <div className="grid gap-2">
          <Link to={`${basePath}/manual`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
            <span>Registrar custo manual</span>
            <span className="text-slate-400">→</span>
          </Link>
          <Link to={`${basePath}/history`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
            <span>Ver histórico completo</span>
            <span className="text-slate-400">→</span>
          </Link>
          <Link to={`${basePath}/audit`} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:border-amber-400 hover:bg-amber-100 transition">
            <span>Auditoria de alterações</span>
            <span className="text-amber-400">→</span>
          </Link>
        </div>
      </div>

      {/* Coluna direita — gráfico */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evolução do custo</div>
          <div className="text-[10px] text-slate-400">{referenceUnit}</div>
        </div>

        {pts.length > 1 ? (
          <div className="flex-1">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: 180 }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="cig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {/* Value labels above points */}
              {pts.map((p, i) => {
                if (i % step !== 0 && i !== pts.length - 1) return null;
                const anchor = i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle";
                const labelY = Math.max(padT - 6, p.y - 8);
                return (
                  <text key={p.date} x={p.x} y={labelY} textAnchor={anchor} fontSize="11" fontWeight="600" fill="#334155">
                    {COMPACT.format(p.value)}
                  </text>
                );
              })}
              <path d={areaPath} fill="url(#cig)" />
              <path d={linePath} fill="none" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r="3.5" fill="#0f172a" />)}
              {/* Date labels below */}
              {pts.map((p, i) => {
                if (i % step !== 0 && i !== pts.length - 1) return null;
                const anchor = i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle";
                return (
                  <text key={`x-${p.date}`} x={p.x} y={svgH - 6} textAnchor={anchor} fontSize="10" fill="#94a3b8">
                    {p.label}
                  </text>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Dados insuficientes para o gráfico.
          </div>
        )}
      </div>

    </div>
  );
}
