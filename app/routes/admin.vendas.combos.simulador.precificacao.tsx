import { useOutletContext } from "@remix-run/react";
import { Calculator, Copy } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  formatMoney,
  formatPercent,
  formatStatus,
  MetricRow,
} from "~/domain/sell-price/components/combo-generator-shared";
import type { AdminVendasGeradorCombosOutletContext } from "./admin.vendas.combos.simulador";

export default function AdminVendasGeradorCombosPrecificacaoPage() {
  const { selectedLines, totals, copySimulation, clearLines } =
    useOutletContext<AdminVendasGeradorCombosOutletContext>();

  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Calculator className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Resultado</h2>
          <p className="text-xs text-slate-500">Simulacao local, sem gravar combo.</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
        <MetricRow label="Soma individual" value={formatMoney(totals.individualTotalPrice)} />
        <MetricRow label="Preco simulado" value={formatMoney(totals.comboPrice)} />
        <MetricRow label="Desconto real" value={`${formatMoney(totals.equivalentDiscountAmount)} (${formatPercent(totals.equivalentDiscountPercentage)})`} />
        <MetricRow label="Custo total da ficha" value={formatMoney(totals.comboTotalCost)} />
        <MetricRow label="DNA aplicado" value={`${formatPercent(totals.dnaPerc)} / ${formatMoney(totals.dnaAmount)}`} />
        <MetricRow label="Custo operacional" value={formatMoney(totals.operationalCost)} strong />
        <MetricRow label="Lucro estimado" value={formatMoney(totals.profitAmount)} />
        <MetricRow
          label="Margem real"
          value={formatPercent(totals.profitPerc)}
          valueClassName={(totals.profitPerc || 0) >= totals.targetMarginPerc ? "text-emerald-700" : "text-amber-700"}
        />
        <MetricRow label="Preco de equilibrio" value={formatMoney(totals.breakEvenPrice)} />
        <MetricRow label="Preco recomendado" value={formatMoney(totals.recommendedPrice)} strong />
        <MetricRow label="Margem alvo" value={formatPercent(totals.targetMarginPerc)} />
        <MetricRow
          label="Status"
          value={formatStatus(totals.status)}
          valueClassName={totals.status === "HEALTHY" ? "text-emerald-700" : totals.status === "BELOW_BREAK_EVEN" ? "text-red-700" : "text-amber-700"}
        />
      </div>

      {!totals.isValidForSale && selectedLines.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Combo invalido para venda.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {totals.invalidReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copySimulation} disabled={selectedLines.length === 0}>
          <Copy className="h-3.5 w-3.5" />
          copiar resumo
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-slate-500" onClick={clearLines} disabled={selectedLines.length === 0}>
          limpar combo
        </Button>
      </div>
    </section>
  );
}
