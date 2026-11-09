import type { ComboPricingStatus } from "~/domain/sell-price/combo-pricing";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return BRL_FORMATTER.format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatStatus(status: ComboPricingStatus) {
  if (status === "HEALTHY") return "Saudavel";
  if (status === "BELOW_BREAK_EVEN") return "Abaixo do equilibrio";
  return "Abaixo da margem alvo";
}

export function ScenarioPanel({
  title,
  revenue,
  profit,
  margin,
  dnaAmount,
}: {
  title: string;
  revenue: number;
  profit: number;
  margin: number;
  dnaAmount: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <div className="mt-2 space-y-1">
        <MetricRow label="Receita" value={formatMoney(revenue)} />
        <MetricRow label="DNA" value={formatMoney(dnaAmount)} />
        <MetricRow label="Lucro" value={formatMoney(profit)} />
        <MetricRow label="Margem" value={formatPercent(margin)} />
      </div>
    </div>
  );
}

export function MetricRow({
  label,
  value,
  strong,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`${strong ? "text-base font-semibold" : "font-medium"} ${valueClassName}`}>{value}</span>
    </div>
  );
}
