import { useOutletContext } from "@remix-run/react";
import { BarChart3 } from "lucide-react";
import {
  formatMoney,
  formatPercent,
  MetricRow,
  ScenarioPanel,
} from "~/domain/sell-price/components/combo-generator-shared";
import type { AdminVendasGeradorCombosOutletContext } from "./admin.vendas.combos.simulador";

export default function AdminVendasGeradorCombosSimuladorVendaPage() {
  const { selectedLines, salesComparison } =
    useOutletContext<AdminVendasGeradorCombosOutletContext>();

  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Simulador de venda</h2>
          <p className="text-xs text-slate-500">Venda avulsa dos itens versus venda no combo.</p>
        </div>
      </div>

      {selectedLines.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Adicione itens ao combo para comparar a venda avulsa com a venda promocional.
        </div>
      ) : (
        <>
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ScenarioPanel
              title="Avulsa"
              revenue={salesComparison.individualSale.priceAmount}
              profit={salesComparison.individualSale.profitAmount}
              margin={salesComparison.individualSale.profitPerc}
              dnaAmount={salesComparison.individualSale.dnaAmount}
            />
            <ScenarioPanel
              title="Combo"
              revenue={salesComparison.comboSale.priceAmount}
              profit={salesComparison.comboSale.profitAmount}
              margin={salesComparison.comboSale.profitPerc}
              dnaAmount={salesComparison.comboSale.dnaAmount}
            />
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <MetricRow
              label="Receita"
              value={formatMoney(salesComparison.priceDeltaAmount)}
              valueClassName={salesComparison.priceDeltaAmount >= 0 ? "text-emerald-700" : "text-amber-700"}
            />
            <MetricRow
              label="Lucro"
              value={`${formatMoney(salesComparison.profitDeltaAmount)} (${formatPercent(salesComparison.profitDeltaPerc)})`}
              valueClassName={salesComparison.profitDeltaAmount >= 0 ? "text-emerald-700" : "text-amber-700"}
            />
            <MetricRow
              label="Margem"
              value={formatPercent(salesComparison.marginDeltaPerc)}
              valueClassName={salesComparison.marginDeltaPerc >= 0 ? "text-emerald-700" : "text-amber-700"}
            />
          </div>
        </>
      )}
    </section>
  );
}
