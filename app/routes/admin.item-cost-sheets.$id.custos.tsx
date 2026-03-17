import { Form, useOutletContext } from "@remix-run/react";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  SheetTypeLabel,
  formatMoney,
  variationLabel,
  type AdminItemCostSheetDetailOutletContext,
} from "./admin.item-cost-sheets.$id";

export default function AdminItemCostSheetCustosTab() {
  const {
    selectedSheet,
    variationSheets,
    compositionRows,
    deletionGuard,
    totalsByVariationId,
    detailPath,
    unitOptions,
    rootSheetId,
    recipeOptions,
    referenceSheetOptions,
  } =
    useOutletContext<AdminItemCostSheetDetailOutletContext>();
  const defaultManualUnit = unitOptions.includes("UN") ? "UN" : unitOptions[0] || "";
  const defaultLaborUnit = unitOptions.includes("H") ? "H" : defaultManualUnit;
  const availableReferenceSheets = referenceSheetOptions.filter((sheet) => sheet.id !== rootSheetId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Composicao da ficha</h3>
          <p className="text-sm text-slate-500">Edite custos por componente e por coluna. As alteracoes permanecem nesta aba.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Form method="post" action={detailPath}>
            <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
            <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-recalc" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              Recalcular ficha
            </Button>
          </Form>
          <Form method="post" action={detailPath}>
            <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
            <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
            <Button
              type="submit"
              variant="outline"
              name="_action"
              value="item-cost-sheet-delete"
              className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={!deletionGuard.canDelete}
            >
              Eliminar ficha
            </Button>
          </Form>
        </div>
      </div>


      {!deletionGuard.canDelete && deletionGuard.reason ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {deletionGuard.reason}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[0.85fr_0.85fr_1.15fr_1.15fr]">
        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] bg-slate-50 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <h5 className="text-sm font-semibold text-slate-900">Receita</h5>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeId">Receita</label>
            <Select name="recipeId" required>
              <SelectTrigger id="recipeId" className="bg-white">
                <SelectValue placeholder="Selecionar receita" />
              </SelectTrigger>
              <SelectContent>
                {recipeOptions.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name}{recipe.variationLabel ? ` (${recipe.variationLabel})` : ""} • med R$ {recipe.avgTotal.toFixed(4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeQuantity">Quantidade</label>
              <NumericInput id="recipeQuantity" name="quantity" min="0.0001" step="0.0001" defaultValue="1" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeWastePerc">Perda %</label>
              <NumericInput id="recipeWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-recipe">
              Adicionar
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] bg-slate-50  p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <h5 className="text-sm font-semibold text-slate-900">Ficha referenciada</h5>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refRecipeSheetId">Ficha</label>
            <Select name="refRecipeSheetId" required>
              <SelectTrigger id="refRecipeSheetId" className="bg-white">
                <SelectValue placeholder="Selecionar ficha" />
              </SelectTrigger>
              <SelectContent>
                {availableReferenceSheets.map((sheet) => (
                  <SelectItem key={sheet.id} value={sheet.id}>
                    {sheet.name} • R$ {Number(sheet.costAmount || 0).toFixed(4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetQuantity">Quantidade</label>
              <NumericInput id="refSheetQuantity" name="quantity" min="0.0001" step="0.0001" defaultValue="1" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetWastePerc">Perda %</label>
              <NumericInput id="refSheetWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-sheet">
              Adicionar
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] bg-slate-50   p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <h4 className="text-sm font-semibold text-slate-900">Adicionar custo manual</h4>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualName">Nome</label>
            <input id="manualName" name="name" className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" placeholder="Ex.: Embalagem" required />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnit">Unidade</label>
              <Select name="unit" required defaultValue={defaultManualUnit}>
                <SelectTrigger id="manualUnit" className="bg-white">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualQuantity">Quantidade</label>
              <NumericInput id="manualQuantity" name="quantity" min="0.0001" step="0.0001" defaultValue="1" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnitCostAmount">Custo unit.</label>
              <NumericInput id="manualUnitCostAmount" name="unitCostAmount" min="0" step="0.0001" defaultValue="0" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualWastePerc">Perda %</label>
              <NumericInput id="manualWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input name="notes" className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-manual">
              Adicionar custo
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] bg-slate-50   p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <h4 className="text-sm font-semibold text-slate-900">Adicionar mao de obra</h4>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborName">Nome</label>
            <input id="laborName" name="name" defaultValue="Mao de obra" className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnit">Unidade</label>
              <Select name="unit" required defaultValue={defaultLaborUnit}>
                <SelectTrigger id="laborUnit" className="bg-white">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborQuantity">Quantidade</label>
              <NumericInput id="laborQuantity" name="quantity" min="0.0001" step="0.0001" defaultValue="1" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnitCostAmount">Custo unit.</label>
              <NumericInput id="laborUnitCostAmount" name="unitCostAmount" min="0" step="0.0001" defaultValue="0" decimalScale={4} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborWastePerc">Perda %</label>
              <NumericInput id="laborWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input name="notes" className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-labor">
              Adicionar mao de obra
            </Button>
          </div>
        </Form>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Componente</th>
              {variationSheets.map((sheet: any) => (
                <th key={sheet.id} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div>{variationLabel(sheet)}</div>
                  <div className="mt-0.5 text-[10px] normal-case tracking-normal text-slate-400">
                    {formatMoney(Number(totalsByVariationId[String(sheet.itemVariationId)] || 0))}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Obs.</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {compositionRows.length === 0 ? (
              <tr>
                <td colSpan={variationSheets.length + 4} className="px-3 py-6 text-center text-slate-500">Nenhum componente na ficha.</td>
              </tr>
            ) : (
              compositionRows.map((line) => {
                const refLocked = line.type === "recipe" || line.type === "recipeSheet";
                const lineFormId = `line-form-${line.id}`;

                return (
                  <tr key={line.id} className="align-top border-t border-slate-100">
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <SheetTypeLabel type={line.type} />
                        <div className="text-[11px] text-slate-400">{line.sourceModel === "component" ? "novo modelo" : "legado"}</div>
                      </div>
                    </td>
                    <td className="min-w-[280px] px-3 py-3">
                      <Form id={lineFormId} method="post" action={detailPath} className="space-y-2">
                        <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                        <input
                          name="name"
                          defaultValue={line.name}
                          readOnly={refLocked}
                          className={`h-9 w-full rounded-xl border px-3 text-sm ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`}
                        />
                        <input
                          name="notes"
                          defaultValue={line.notes || ""}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                          placeholder="Observacao"
                        />
                      </Form>
                    </td>
                    {variationSheets.map((sheet: any) => {
                      const value = line.variationValues.find((row) => row.itemVariationId === sheet.itemVariationId) || null;
                      return (
                        <td key={sheet.id} className="min-w-[220px] px-3 py-3">
                          <div className="space-y-2">
                            {refLocked ? (
                              <input form={lineFormId} name={`unit__${sheet.itemVariationId}`} defaultValue={value?.unit || ""} readOnly className="h-8 w-full rounded-xl border border-slate-100 bg-slate-50 px-2.5 text-xs text-slate-500" />
                            ) : (
                              <Select
                                name={`unit__${sheet.itemVariationId}`}
                                form={lineFormId}
                                required
                                defaultValue={unitOptions.includes(String(value?.unit || "").toUpperCase()) ? String(value?.unit || "").toUpperCase() : (String(value?.unit || "") || defaultManualUnit)}
                              >
                                <SelectTrigger className="h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs">
                                  <SelectValue placeholder="Unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                  {unitOptions.map((unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {unit}
                                    </SelectItem>
                                  ))}
                                  {value?.unit && !unitOptions.includes(String(value.unit).toUpperCase()) ? (
                                    <SelectItem value={String(value.unit)}>
                                      {String(value.unit)}
                                    </SelectItem>
                                  ) : null}
                                </SelectContent>
                              </Select>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <NumericInput form={lineFormId} name={`quantity__${sheet.itemVariationId}`} min="0.0001" step="0.0001" defaultValue={Number(value?.quantity || 0)} decimalScale={4} className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-right" required />
                              <NumericInput form={lineFormId} name={`unitCostAmount__${sheet.itemVariationId}`} min="0" step="0.0001" defaultValue={Number(value?.unitCostAmount || 0)} decimalScale={4} readOnly={refLocked} className={`h-8 rounded-xl border px-2.5 text-xs text-right ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`} required />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <NumericInput form={lineFormId} name={`wastePerc__${sheet.itemVariationId}`} min="0" step="0.01" defaultValue={Number(value?.wastePerc || 0)} decimalScale={2} className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-right" />
                              <div className="flex items-center justify-end rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
                                {formatMoney(Number(value?.totalCostAmount || 0))}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-xs text-slate-500">Edite no campo do componente</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Form method="post" action={detailPath} className="inline">
                          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="direction" value="up" />
                          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                          <button type="submit" name="_action" value="item-cost-sheet-line-move" className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Subir">↑</button>
                        </Form>
                        <button type="submit" form={lineFormId} name="_action" value="item-cost-sheet-line-update" className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Salvar
                        </button>
                        <Form method="post" action={detailPath} className="inline">
                          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="direction" value="down" />
                          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                          <button type="submit" name="_action" value="item-cost-sheet-line-move" className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Descer">↓</button>
                        </Form>
                        <Form method="post" action={detailPath} className="inline">
                          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                          <button type="submit" name="_action" value="item-cost-sheet-line-delete" className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Remover
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
