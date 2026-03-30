import { Form, Link, useOutletContext } from "@remix-run/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemPurchasesTab() {
  const { item, costMetrics, averageWindowDays, unitOptions, restrictedUnits, linkedUnitCodes } =
    useOutletContext<AdminItemOutletContext>();

  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || item._itemCostVariationHistory?.[0] || null;
  const referenceUnit = item.consumptionUm || latestCost?.unit || item.purchaseUm || "";
  const canConfigureConversion = !!item.consumptionUm;

  const [conversionUm, setConversionUm] = useState("__EMPTY__");

  const conversions: Array<{ id: string; purchaseUm: string; factor: number }> =
    item.ItemPurchaseConversion ?? [];
  const itemUnits: Array<{ id: string; unitCode: string }> = item.ItemUnit ?? [];

  const usedConversionUnits = new Set(conversions.map((c) => c.purchaseUm));

  // Linked restricted units that don't yet have a conversion factor configured
  const pendingLinkedUnits = itemUnits.filter((iu) => !usedConversionUnits.has(iu.unitCode));

  const availableConversionUnits = unitOptions.filter((u) => u !== item.consumptionUm && !usedConversionUnits.has(u));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">

        {!canConfigureConversion && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Defina primeiro a unidade de consumo na aba Principal para configurar as conversões.
          </div>
        )}

        {/* Conversões de compra — unified with linked restricted units */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversões de compra</h2>
              <p className="mt-0.5 text-xs text-slate-400">Fator fixo por unidade. Ex: 1 KG = 1 KG.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Base: {item.consumptionUm || "não definida"}</span>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to="/admin/unidades-consumo/new">Nova UM</Link>
              </Button>
            </div>
          </div>

          {conversions.length === 0 && pendingLinkedUnits.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Nenhuma conversão configurada.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {/* Configured conversions */}
              {conversions.map((conv) => {
                const restrictedUnit = restrictedUnits.find((u) => u.code === conv.purchaseUm);
                return (
                  <li key={conv.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      1 {conv.purchaseUm} = {Number(conv.factor).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {item.consumptionUm}
                      {restrictedUnit && (
                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-xs">
                          restrita
                        </Badge>
                      )}
                    </span>
                    <Form method="post" action="..">
                      <input type="hidden" name="_action" value="item-purchase-conversion-delete" />
                      <input type="hidden" name="conversionId" value={conv.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </Form>
                  </li>
                );
              })}

              {/* Linked restricted units without a conversion factor */}
              {pendingLinkedUnits.map((iu) => {
                const unit = restrictedUnits.find((u) => u.code === iu.unitCode);
                return (
                  <li key={iu.id} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-violet-800">
                        {iu.unitCode}{unit ? ` — ${unit.name}` : ""}
                        <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-700 text-xs">
                          sem fator
                        </Badge>
                      </span>
                    </div>
                    {canConfigureConversion && (
                      <Form method="post" action=".." className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="_action" value="item-purchase-conversion-add" />
                        <input type="hidden" name="purchaseUm" value={iu.unitCode} />
                        <div className="flex-1">
                          <Label className="text-xs text-violet-700">
                            Fator (1 {iu.unitCode} = ? {item.consumptionUm})
                          </Label>
                          <DecimalInput name="factor" fractionDigits={4} placeholder="0,0000" className="mt-1 w-full" />
                        </div>
                        <Button type="submit" size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-100">
                          Definir
                        </Button>
                      </Form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canConfigureConversion && (
            <Form method="post" action=".." className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              <input type="hidden" name="_action" value="item-purchase-conversion-add" />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Unidade</Label>
                  <input type="hidden" name="purchaseUm" value={conversionUm === "__EMPTY__" ? "" : conversionUm} />
                  <Select value={conversionUm} onValueChange={setConversionUm}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                      {availableConversionUnits.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fator (1 {conversionUm !== "__EMPTY__" ? conversionUm : "UM"} = ? {item.consumptionUm})</Label>
                  <DecimalInput name="factor" fractionDigits={4} placeholder="0,0000" className="mt-1 w-full" />
                </div>
              </div>
              <Button type="submit" size="sm" className="bg-slate-900 hover:bg-slate-700">Adicionar conversão</Button>
            </Form>
          )}

          {linkedUnitCodes.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Para vincular mais unidades restritas acesse{" "}
              <Link to="/admin/unidades-consumo" className="underline hover:text-slate-600">Unidades de consumo</Link>.
            </p>
          )}
        </div>

        {/* Base de compra */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Base de compra</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div>Pode comprar: {item.canPurchase ? "Sim" : "Não"}</div>
            <div>Tem estoque: {item.canStock ? "Sim" : "Não"}</div>
            <div>
              Último custo:{" "}
              {costMetrics?.latestCostPerConsumptionUnit != null
                ? `R$ ${Number(costMetrics.latestCostPerConsumptionUnit).toFixed(4)} ${referenceUnit}`.trim()
                : "não informado"}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fluxo legado de produtos</h2>
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
