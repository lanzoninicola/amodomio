import { Form, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemPurchasesTab() {
  const { item, costMetrics, averageWindowDays, unitOptions } = useOutletContext<AdminItemOutletContext>();
  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || item._itemCostVariationHistory?.[0] || null;
  const canConfigureConversion = !!item.consumptionUm;
  const [purchaseUmValue, setPurchaseUmValue] = useState(item.purchaseUm || "__EMPTY__");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversão de compra</h2>
            <span className="text-xs text-slate-500">
              Base de consumo: {item.consumptionUm || "não definida"}
            </span>
          </div>

          {!canConfigureConversion ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Defina primeiro a unidade de consumo na aba Principal para configurar a conversão de compra.
            </div>
          ) : null}

          <Form method="post" action=".." className="mt-3 space-y-3">
            <input type="hidden" name="_action" value="item-purchase-conversion-update" />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="purchaseUm">Unidade de compra</Label>
                <input
                  type="hidden"
                  name="purchaseUm"
                  value={purchaseUmValue === "__EMPTY__" ? "" : purchaseUmValue}
                />
                <Select
                  value={purchaseUmValue}
                  onValueChange={setPurchaseUmValue}
                  disabled={!canConfigureConversion}
                >
                  <SelectTrigger id="purchaseUm" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="purchaseToConsumptionFactor">
                  Fator (1 compra = ? {item.consumptionUm || "consumo"})
                </Label>
                <Input
                  id="purchaseToConsumptionFactor"
                  name="purchaseToConsumptionFactor"
                  type="number"
                  min="0"
                  step="0.000001"
                  defaultValue={item.purchaseToConsumptionFactor ?? ""}
                  placeholder="ex: 1000"
                  disabled={!canConfigureConversion}
                />
              </div>
            </div>

            {item.purchaseUm && item.consumptionUm && item.purchaseToConsumptionFactor ? (
              <div className="text-xs text-slate-700">
                Configuração atual: 1 {item.purchaseUm} = {Number(item.purchaseToConsumptionFactor).toFixed(6)}{" "}
                {item.consumptionUm}
              </div>
            ) : null}

            <Button type="submit" className="bg-slate-900 hover:bg-slate-700" disabled={!canConfigureConversion}>
              Salvar conversão
            </Button>
          </Form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Base de compra</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div>Pode comprar: {item.canPurchase ? "Sim" : "Não"}</div>
            <div>Tem estoque: {item.canStock ? "Sim" : "Não"}</div>
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
          <p className="mt-4 text-xs text-slate-500">
            Esta aba é leitura inicial. O fluxo de compras/lista de compras ainda está em transição para `Item`.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fluxo legado de produtos</h2>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-500">
            O vínculo de compras com `Product` foi descontinuado. Este fluxo passa a usar somente `Item`.
          </p>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximos passos</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
            <li>vincular lista de compras ao Item</li>
            <li>registrar compras alimentando `ItemCostVariation` (variação base)</li>
            <li>consolidar fornecedores por item</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
