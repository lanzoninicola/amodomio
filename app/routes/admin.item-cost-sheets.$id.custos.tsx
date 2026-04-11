import { Form, Link, useOutletContext } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Button } from "~/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
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
    totalsByVariationId,
    detailPath,
    unitOptions,
    rootSheetId,
    recipeOptions,
    referenceSheetOptions,
  } =
    useOutletContext<AdminItemCostSheetDetailOutletContext>();
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedReferenceSheetId, setSelectedReferenceSheetId] = useState("");
  const defaultManualUnit = unitOptions.includes("UN") ? "UN" : unitOptions[0] || "";
  const defaultLaborUnit = unitOptions.includes("H") ? "H" : defaultManualUnit;
  const availableReferenceSheets = referenceSheetOptions.filter((sheet) => sheet.id !== rootSheetId);
  const isActive = variationSheets.some((sheet: any) => sheet.isActive);
  const recipeSelectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      recipeOptions.map((recipe) => ({
        value: recipe.id,
        label: `${recipe.name}${recipe.variationLabel ? ` (${recipe.variationLabel})` : ""}`,
        searchText: [recipe.name, recipe.variationLabel || "", recipe.type || ""]
          .filter(Boolean)
          .join(" "),
      })),
    [recipeOptions]
  );
  const referenceSheetSelectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      availableReferenceSheets.map((sheet) => ({
        value: sheet.id,
        label: sheet.name,
        searchText: [sheet.name, Number(sheet.costAmount || 0).toFixed(2)].filter(Boolean).join(" "),
      })),
    [availableReferenceSheets]
  );

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "s") return;

      event.preventDefault();

      const activeElement = document.activeElement as HTMLElement | null;
      const activeForm = activeElement?.closest("form[id^='line-form-']") as HTMLFormElement | null;
      const activeSubmitButton = activeForm?.querySelector<HTMLButtonElement>("[data-cost-sheet-save='true']");

      if (activeSubmitButton) {
        activeSubmitButton.click();
        return;
      }

      const fallbackSubmitButton = document.querySelector<HTMLButtonElement>("[data-cost-sheet-save='true']");
      fallbackSubmitButton?.click();
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Custos</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
            {isActive ? "Ativa" : "Rascunho"}
          </div>
          <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Link to="/admin/cost-monitoring">
              Consultar custos
            </Link>
          </Button>
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
            >
              Eliminar ficha
            </Button>
          </Form>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.85fr_0.85fr_1.15fr_1.15fr]">
        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
              <h5 className="mt-1 text-sm font-semibold text-slate-900">Receita</h5>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeId">Receita</label>
            <input type="hidden" name="recipeId" value={selectedRecipeId} />
            <SearchableSelect
              value={selectedRecipeId}
              onValueChange={setSelectedRecipeId}
              options={recipeSelectOptions}
              placeholder="Selecionar receita"
              searchPlaceholder="Buscar receita..."
              emptyText="Nenhuma receita encontrada."
              triggerClassName="h-10 w-full max-w-none justify-between rounded-lg border-slate-200 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
              renderOption={(option) => {
                const recipe = recipeOptions.find((entry) => entry.id === option.value);
                if (!recipe) return option.label;

                return (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-slate-900">{option.label}</span>
                    <span className="text-xs text-slate-500">Componente de produção</span>
                  </div>
                );
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeQuantity">Quantidade</label>
              <NumericInput id="recipeQuantity" name="quantity" min="0.01" step="0.01" defaultValue="1" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeWastePerc">Perda %</label>
              <NumericInput id="recipeWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              name="_action"
              value="item-cost-sheet-line-add-recipe"
              className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              disabled={!selectedRecipeId}
            >
              Adicionar
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
            <h5 className="mt-1 text-sm font-semibold text-slate-900">Ficha referenciada</h5>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refRecipeSheetId">Ficha</label>
            <input type="hidden" name="refRecipeSheetId" value={selectedReferenceSheetId} />
            <SearchableSelect
              value={selectedReferenceSheetId}
              onValueChange={setSelectedReferenceSheetId}
              options={referenceSheetSelectOptions}
              placeholder="Selecionar ficha"
              searchPlaceholder="Buscar ficha..."
              emptyText="Nenhuma ficha encontrada."
              triggerClassName="h-10 w-full max-w-none justify-between rounded-lg border-slate-200 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
              renderOption={(option) => {
                const sheet = availableReferenceSheets.find((entry) => entry.id === option.value);
                if (!sheet) return option.label;

                return (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-slate-900">{option.label}</span>
                    <span className="text-xs text-slate-500">R$ {Number(sheet.costAmount || 0).toFixed(2)}</span>
                  </div>
                );
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetQuantity">Quantidade</label>
              <NumericInput id="refSheetQuantity" name="quantity" min="0.01" step="0.01" defaultValue="1" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetWastePerc">Perda %</label>
              <NumericInput id="refSheetWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              name="_action"
              value="item-cost-sheet-line-add-sheet"
              className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              disabled={!selectedReferenceSheetId}
            >
              Adicionar
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">Custo manual</h4>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualName">Nome</label>
            <input id="manualName" name="name" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Ex.: Embalagem" required />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnit">Unidade</label>
              <Select name="unit" required defaultValue={defaultManualUnit}>
                <SelectTrigger id="manualUnit" className="h-10 rounded-lg border-slate-200 bg-white">
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
              <NumericInput id="manualQuantity" name="quantity" min="0.01" step="0.01" defaultValue="1" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnitCostAmount">Custo unit.</label>
              <MoneyInput id="manualUnitCostAmount" name="unitCostAmount" defaultValue={0} className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualWastePerc">Perda %</label>
              <NumericInput id="manualWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input name="notes" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-manual" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
              Adicionar custo
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">Mao de obra</h4>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborName">Nome</label>
            <input id="laborName" name="name" defaultValue="Mao de obra" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnit">Unidade</label>
              <Select name="unit" required defaultValue={defaultLaborUnit}>
                <SelectTrigger id="laborUnit" className="h-10 rounded-lg border-slate-200 bg-white">
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
              <NumericInput id="laborQuantity" name="quantity" min="0.01" step="0.01" defaultValue="1" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnitCostAmount">Custo unit.</label>
              <MoneyInput id="laborUnitCostAmount" name="unitCostAmount" defaultValue={0} className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborWastePerc">Perda %</label>
              <NumericInput id="laborWastePerc" name="wastePerc" min="0" step="0.01" defaultValue="0" decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input name="notes" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-labor" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
              Adicionar mao de obra
            </Button>
          </div>
        </Form>
      </div>

      <section className="">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Composicao da ficha</div>
          <div className="mt-1 text-sm text-slate-500">Edite cada componente por variacao com a mesma leitura visual da grade de precos.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-white px-3 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Componente</th>
                {variationSheets.map((sheet: any) => (
                  <th key={sheet.id} className="min-w-[292px] px-3 py-4 text-left text-xs font-semibold ">
                    <div className="text-[15px] font-semibold text-slate-700">{variationLabel(sheet)}</div>
                    <div className="mt-1 text-xs font-mono normal-case tracking-normal text-slate-400">
                      {formatMoney(Number(totalsByVariationId[String(sheet.itemVariationId)] || 0))}
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-white px-3 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {compositionRows.length === 0 ? (
                <tr>
                  <td colSpan={variationSheets.length + 2} className="px-3 py-6 text-center text-slate-500">Nenhum componente na ficha.</td>
                </tr>
              ) : (
                compositionRows.map((line) => {
                  const refLocked = line.type === "recipe" || line.type === "recipeSheet";
                  const lineFormId = `line-form-${line.id}`;

                  return (
                    <tr key={line.id}>
                      <td className="sticky left-0 z-10 min-w-[280px] border-t border-slate-100 bg-white px-3 py-4 align-top">
                        <Form id={lineFormId} method="post" action={detailPath} className="space-y-2">
                          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                          <div className="pb-1">
                            <SheetTypeLabel type={line.type} />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nome</label>
                            <input
                              name="name"
                              defaultValue={line.name}
                              readOnly={refLocked}
                              className={`h-9 w-full rounded-lg border px-3 text-sm ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`}
                            />
                          </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Observacao</label>
                          <input
                            name="notes"
                            defaultValue={line.notes || ""}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs"
                            placeholder="Observacao"
                          />
                        </div>
                        <button type="submit" name="_action" value="item-cost-sheet-line-update" data-cost-sheet-save="true" className="hidden" aria-hidden="true" tabIndex={-1}>
                          Salvar linha
                        </button>
                      </Form>
                    </td>
                      {variationSheets.map((sheet: any) => {
                        const value = line.variationValues.find((row) => row.itemVariationId === sheet.itemVariationId) || null;
                        return (
                          <td key={sheet.id} className="min-w-[292px] border-t border-slate-100 px-3 py-4 align-top">
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50/65 p-3">
                              <div className="grid grid-cols-[78px_74px_94px] gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unid.</label>
                                  {refLocked ? (
                                    <input form={lineFormId} name={`unit__${sheet.itemVariationId}`} defaultValue={value?.unit || ""} readOnly className="h-8 w-full rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-xs text-slate-500" />
                                  ) : (
                                    <Select
                                      name={`unit__${sheet.itemVariationId}`}
                                      form={lineFormId}
                                      required
                                      defaultValue={unitOptions.includes(String(value?.unit || "").toUpperCase()) ? String(value?.unit || "").toUpperCase() : (String(value?.unit || "") || defaultManualUnit)}
                                    >
                                      <SelectTrigger className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs">
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
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qtd.</label>
                                  <NumericInput form={lineFormId} name={`quantity__${sheet.itemVariationId}`} min="0.01" step="0.01" defaultValue={Number(value?.quantity || 0)} decimalScale={2} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-right" required />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custo un.</label>
                                  <MoneyInput
                                    form={lineFormId}
                                    name={`unitCostAmount__${sheet.itemVariationId}`}
                                    defaultValue={Number(value?.unitCostAmount || 0)}
                                    readOnly={refLocked}
                                    className={`h-8 w-full rounded-lg px-2 text-xs text-right ${refLocked ? "border border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="mt-2 grid grid-cols-[74px_96px] gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Perda %</label>
                                  <NumericInput form={lineFormId} name={`wastePerc__${sheet.itemVariationId}`} min="0" step="0.01" defaultValue={Number(value?.wastePerc || 0)} decimalScale={2} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-right" />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</label>
                                  <NumericInput
                                    defaultValue={Number(value?.totalCostAmount || 0)}
                                    decimalScale={2}
                                    readOnly
                                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-right text-slate-700"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 w-[88px] border-t border-slate-100 bg-white px-2 py-4 align-top">
                        <div className="inline-grid grid-cols-2 gap-3 pt-10">
                          <Form method="post" action={detailPath} className="contents">
                            <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="direction" value="up" />
                            <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                            <button type="submit" name="_action" value="item-cost-sheet-line-move" className="flex h-8 w-9 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Subir">↑</button>
                          </Form>
                          <button type="submit" form={lineFormId} name="_action" value="item-cost-sheet-line-update" className="flex h-8 w-9 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Salvar">
                            ✓
                          </button>
                          <Form method="post" action={detailPath} className="contents">
                            <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="direction" value="down" />
                            <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                            <button type="submit" name="_action" value="item-cost-sheet-line-move" className="flex h-8 w-9 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Descer">↓</button>
                          </Form>
                          <Form method="post" action={detailPath} className="contents">
                            <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                            <button type="submit" name="_action" value="item-cost-sheet-line-delete" className="flex h-8 w-9 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Remover">
                              ×
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
      </section>
    </div>
  );
}
