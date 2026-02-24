import { Form, useOutletContext } from "@remix-run/react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemCostsTab() {
  const { item, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();
  const history = item._itemCostVariationHistory || [];
  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || history[0] || null;
  const measurementSummary =
    item.purchaseUm && item.consumptionUm && item.purchaseToConsumptionFactor
      ? `1 ${item.purchaseUm} = ${Number(item.purchaseToConsumptionFactor).toFixed(6)} ${item.consumptionUm}`
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Form method="post" action=".." className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <input type="hidden" name="_action" value="item-cost-add" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Registrar custo</h2>
        {measurementSummary ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Conversão do item: {measurementSummary}
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Configure a conversão na aba Principal para padronizar custo de compra vs consumo/estoque.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Custo</Label>
            <MoneyInput name="costAmount" />
          </div>
          <div>
            <Label htmlFor="unit">Unidade</Label>
            <Input
              id="unit"
              name="unit"
              placeholder="ex: KG, UN, LT"
              defaultValue={latestCost?.unit || item.purchaseUm || ""}
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="source">Fonte</Label>
            <Input id="source" name="source" defaultValue="manual" />
          </div>
          <div>
            <Label htmlFor="supplierName">Fornecedor</Label>
            <Input id="supplierName" name="supplierName" />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Observação</Label>
          <Input id="notes" name="notes" />
        </div>
        <Button type="submit" variant="outline">
          Registrar custo
        </Button>
      </Form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de custos</h2>
        <div className="mt-3 text-sm">
          <div>
            Último custo:{" "}
            {latestCost ? `R$ ${Number(latestCost.costAmount || 0).toFixed(2)} ${latestCost.unit || ""}` : "não informado"}
          </div>
          <div>
            Custo médio ({averageWindowDays} dias):{" "}
            {costMetrics?.averageCostPerConsumptionUnit != null
              ? `R$ ${Number(costMetrics.averageCostPerConsumptionUnit).toFixed(4)} ${item.consumptionUm || ""}`.trim()
              : "não informado"}
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {history.length === 0 ? (
            <li className="text-slate-500">Nenhum custo registrado.</li>
          ) : (
            history.map((c: any) => (
              <li key={c.id} className="rounded border border-slate-100 p-2">
                <div className="font-medium">
                  R$ {Number(c.costAmount || 0).toFixed(2)} {c.unit || ""}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(c.validFrom).toLocaleString("pt-BR")} • {c.source || "manual"}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
