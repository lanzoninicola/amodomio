import { Form, Link, useOutletContext } from "@remix-run/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemPurchasesTab() {
  const { item, costMetrics, averageWindowDays, unitOptions, measurementUnits, restrictedUnits, linkedUnitCodes } =
    useOutletContext<AdminItemOutletContext>();

  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || item._itemCostVariationHistory?.[0] || null;
  const referenceUnit = item.consumptionUm || latestCost?.unit || item.purchaseUm || "";
  const canConfigureConversion = !!item.consumptionUm;

  const [conversionUm, setConversionUm] = useState("__EMPTY__");

  const conversions: Array<{ id: string; purchaseUm: string; factor: number }> =
    item.ItemPurchaseConversion ?? [];
  const itemUnits: Array<{ id: string; unitCode: string }> = item.ItemUnit ?? [];

  const usedConversionUnits = new Set(conversions.map((c) => c.purchaseUm));
  const pendingLinkedUnits = itemUnits.filter((iu) => !usedConversionUnits.has(iu.unitCode));
  const availableConversionUnits = unitOptions.filter((u) => u !== item.consumptionUm && !usedConversionUnits.has(u));

  const returnTo = `/admin/items/${item.id}/purchases`;

  function getUnitMeta(unitCode: string) {
    return measurementUnits.find((unit) => unit.code === unitCode) ?? null;
  }

  function getUnitDisplayName(unitCode: string) {
    const unitName = getUnitMeta(unitCode)?.name || unitCode;
    return unitName.toLocaleLowerCase("pt-BR");
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {!canConfigureConversion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Defina primeiro a unidade de consumo na aba Principal para configurar as conversões.
        </div>
      )}

      {/* Conversões de compra */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversões de compra</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Fator fixo por unidade. Base:{" "}
              <span className="font-medium text-slate-600">{item.consumptionUm || "não definida"}</span>
            </p>
          </div>
          <Button asChild size="sm" className="h-8 bg-black hover:bg-black/80 text-white">
            <Link to={`/admin/unidades-consumo/new?returnTo=${encodeURIComponent(returnTo)}&itemId=${encodeURIComponent(item.id)}`}>Nova UM</Link>
          </Button>
        </div>

        {conversions.length === 0 && pendingLinkedUnits.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Nenhuma conversão configurada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
            <Table className="min-w-[1080px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="h-9 min-w-[120px] px-3 text-xs">Unidade compra</TableHead>
                  <TableHead className="h-9 min-w-[180px] px-3 text-xs">Descrição unidade</TableHead>
                  <TableHead className="h-9 min-w-[110px] px-3 text-xs">Fator</TableHead>
                  <TableHead className="h-9 min-w-[90px] px-3 text-xs">Base</TableHead>
                  <TableHead className="h-9 min-w-[100px] px-3 text-xs">Tipo</TableHead>
                  <TableHead className="h-9 min-w-[360px] px-3 text-xs">Explicação</TableHead>
                  <TableHead className="h-9 w-10 px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.map((conv) => {
                  const unitMeta = getUnitMeta(conv.purchaseUm);
                  const restrictedUnit = restrictedUnits.find((u) => u.code === conv.purchaseUm);
                  return (
                    <TableRow key={conv.id} className="border-slate-100">
                      <TableCell className="px-3 py-2">
                        {unitMeta ? (
                          <Link
                            to={`/admin/unidades-consumo/${unitMeta.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950"
                          >
                            {conv.purchaseUm}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-800">{conv.purchaseUm}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm text-slate-600">
                        {unitMeta?.name || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-2 font-mono tabular-nums text-slate-700">
                        {Number(conv.factor).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-slate-500">{item.consumptionUm}</TableCell>
                      <TableCell className="px-3 py-2">
                        {restrictedUnit ? (
                          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-xs">
                            restrita
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-xs">
                            global
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm text-slate-600">
                        1 {getUnitDisplayName(conv.purchaseUm)} ({conv.purchaseUm}) equivale a{" "}
                        <span className="font-mono tabular-nums text-slate-700">
                          {Number(conv.factor).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                        </span>{" "}
                        {item.consumptionUm}.
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Form method="post" action="..">
                          <input type="hidden" name="_action" value="item-purchase-conversion-delete" />
                          <input type="hidden" name="conversionId" value={conv.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </Form>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {pendingLinkedUnits.map((iu) => (
                  <TableRow key={iu.id} className="border-violet-100 bg-violet-50/40">
                    <TableCell className="px-3 py-2">
                      {(() => {
                        const unitMeta = getUnitMeta(iu.unitCode);
                        return unitMeta ? (
                          <Link
                            to={`/admin/unidades-consumo/${unitMeta.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-violet-800 underline underline-offset-2 hover:text-violet-950"
                          >
                            {iu.unitCode}
                          </Link>
                        ) : (
                          <span className="font-medium text-violet-800">{iu.unitCode}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-sm text-violet-800">
                      {getUnitMeta(iu.unitCode)?.name || "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {canConfigureConversion ? (
                        <Form method="post" action=".." className="flex items-center gap-2">
                          <input type="hidden" name="_action" value="item-purchase-conversion-add" />
                          <input type="hidden" name="purchaseUm" value={iu.unitCode} />
                          <DecimalInput name="factor" fractionDigits={4} placeholder="0,0000" className="w-28 h-7 text-sm font-mono tabular-nums" />
                          <Button type="submit" size="sm" variant="outline" className="h-7 border-violet-300 text-violet-700 hover:bg-violet-100 text-xs px-2">
                            Salvar
                          </Button>
                        </Form>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-slate-500">{item.consumptionUm}</TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-700 text-xs">
                        sem fator
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-sm text-violet-800">
                      {canConfigureConversion
                        ? `Defina quantos ${item.consumptionUm} existem em 1 ${getUnitDisplayName(iu.unitCode)} (${iu.unitCode}).`
                        : `Defina a unidade de consumo para configurar 1 ${getUnitDisplayName(iu.unitCode)} (${iu.unitCode}).`}
                    </TableCell>
                    <TableCell className="px-3 py-2" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {canConfigureConversion && (
          <Form method="post" action=".." className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <input type="hidden" name="_action" value="item-purchase-conversion-add" />
            <input type="hidden" name="purchaseUm" value={conversionUm === "__EMPTY__" ? "" : conversionUm} />
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={conversionUm} onValueChange={setConversionUm}>
                <SelectTrigger className="mt-1 h-9 w-40">
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
              <Label className="text-xs">
                Fator (1 {conversionUm !== "__EMPTY__" ? conversionUm : "UM"} = ? {item.consumptionUm})
              </Label>
              <DecimalInput name="factor" fractionDigits={4} placeholder="0,0000" className="mt-1 h-9 w-36 font-mono tabular-nums" />
            </div>
            <Button type="submit" size="sm" className="h-9 bg-slate-900 hover:bg-slate-700">Adicionar</Button>
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
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Pode comprar</span>
            <span className="font-medium text-slate-800">{item.canPurchase ? "Sim" : "Não"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Tem estoque</span>
            <span className="font-medium text-slate-800">{item.canStock ? "Sim" : "Não"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Último custo</span>
            <span className="font-medium tabular-nums text-slate-800">
              {costMetrics?.latestCostPerConsumptionUnit != null
                ? `R$ ${Number(costMetrics.latestCostPerConsumptionUnit).toFixed(4)} / ${referenceUnit}`.trim()
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Custo médio ({averageWindowDays}d)</span>
            <span className="font-medium tabular-nums text-slate-800">
              {costMetrics?.averageCostPerConsumptionUnit != null
                ? `R$ ${Number(costMetrics.averageCostPerConsumptionUnit).toFixed(4)} / ${item.consumptionUm || ""}`.trim()
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
