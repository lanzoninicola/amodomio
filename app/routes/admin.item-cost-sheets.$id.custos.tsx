import { Form, Link, useNavigation, useOutletContext } from "@remix-run/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  SheetTypeLabel,
  formatCompactMoney,
  formatMoney,
  variationLabel,
  type AdminItemCostSheetDetailOutletContext,
} from "./admin.item-cost-sheets.$id";

function formatQuantity(value: number, digits = 3) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function presetVariationText(preset: {
  variationLabel?: string | null;
  variationCode?: string | null;
  variationKind?: string | null;
} | null | undefined) {
  if (!preset?.variationLabel) return "Todas as variacoes da ficha";
  const parts = [preset.variationLabel, preset.variationCode, preset.variationKind].filter(Boolean);
  return parts.join(" · ");
}

export default function AdminItemCostSheetCustosTab() {
  const {
    selectedSheet,
    variationSheets,
    compositionRows,
    recipeCompositionBreakdownByLineId,
    totalsByVariationId,
    detailPath,
    unitOptions,
    rootSheetId,
    recipeOptions,
    referenceSheetOptions,
    componentPresets,
    presetVariations,
  } =
    useOutletContext<AdminItemCostSheetDetailOutletContext>();
  const navigation = useNavigation();
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedReferenceSheetId, setSelectedReferenceSheetId] = useState("");
  const [selectedManualPresetId, setSelectedManualPresetId] = useState("");
  const [selectedLaborPresetId, setSelectedLaborPresetId] = useState("");
  const [selectedRecipeBreakdownTarget, setSelectedRecipeBreakdownTarget] = useState<{
    lineId: string;
    itemVariationId: string;
  } | null>(null);
  const defaultManualUnit = unitOptions.includes("UN") ? "UN" : unitOptions[0] || "";
  const defaultLaborUnit = unitOptions.includes("H") ? "H" : defaultManualUnit;
  const availableReferenceSheets = referenceSheetOptions.filter((sheet) => sheet.id !== rootSheetId);
  const isActive = variationSheets.some((sheet: any) => sheet.isActive);
  const manualPresets = componentPresets.filter((preset) => preset.type === "manual");
  const laborPresets = componentPresets.filter((preset) => preset.type === "labor");
  const selectedManualPreset = manualPresets.find((preset) => preset.id === selectedManualPresetId) || null;
  const selectedLaborPreset = laborPresets.find((preset) => preset.id === selectedLaborPresetId) || null;
  const customPresetOption = { value: "__custom__", label: "Personalizado", searchText: "personalizado livre manual" };
  const manualPresetOptions = useMemo<SearchableSelectOption[]>(
    () => [
      customPresetOption,
      ...manualPresets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        searchText: [preset.name, preset.key, preset.unit || "", preset.variationLabel || "", preset.variationCode || ""].filter(Boolean).join(" "),
      })),
    ],
    [manualPresets]
  );
  const laborPresetOptions = useMemo<SearchableSelectOption[]>(
    () => [
      customPresetOption,
      ...laborPresets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        searchText: [preset.name, preset.key, preset.unit || "", preset.variationLabel || "", preset.variationCode || ""].filter(Boolean).join(" "),
      })),
    ],
    [laborPresets]
  );
  const presetVariationOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: "__all__",
        label: "Todas as variacoes da ficha",
        searchText: "todas variacoes ficha geral",
      },
      ...presetVariations.map((variation) => ({
        value: variation.id,
        label: variation.name,
        searchText: [variation.name, variation.code, variation.kind].filter(Boolean).join(" "),
      })),
    ],
    [presetVariations]
  );
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
  const manualPresetUnit = selectedManualPreset?.unit && unitOptions.includes(String(selectedManualPreset.unit).toUpperCase())
    ? String(selectedManualPreset.unit).toUpperCase()
    : defaultManualUnit;
  const laborPresetUnit = selectedLaborPreset?.unit && unitOptions.includes(String(selectedLaborPreset.unit).toUpperCase())
    ? String(selectedLaborPreset.unit).toUpperCase()
    : defaultLaborUnit;
  const selectedRecipeBreakdown = selectedRecipeBreakdownTarget
    ? recipeCompositionBreakdownByLineId[selectedRecipeBreakdownTarget.lineId]?.[selectedRecipeBreakdownTarget.itemVariationId] || null
    : null;
  const selectedRecipeLine = selectedRecipeBreakdownTarget
    ? compositionRows.find((line) => line.id === selectedRecipeBreakdownTarget.lineId) || null
    : null;
  const selectedRecipeValue = selectedRecipeBreakdownTarget && selectedRecipeLine
    ? selectedRecipeLine.variationValues.find(
      (row) => row.itemVariationId === selectedRecipeBreakdownTarget.itemVariationId
    ) || null
    : null;
  const selectedVariationSheet = selectedRecipeBreakdownTarget
    ? variationSheets.find(
      (sheet: any) => sheet.itemVariationId === selectedRecipeBreakdownTarget.itemVariationId
    ) || null
    : null;
  const selectedVariationLabel = selectedVariationSheet
    ? variationLabel(selectedVariationSheet)
    : null;

  const rowAlerts = useMemo(() => {
    const result: Record<string, { hasZeroCost: boolean; hasZeroIngredient: boolean }> = {};
    for (const line of compositionRows) {
      if (line.type !== "recipe" && line.type !== "recipeSheet") continue;
      const hasZeroCost = line.variationValues.some((v) => Number(v.unitCostAmount || 0) === 0);
      let hasZeroIngredient = false;
      if (line.type === "recipe") {
        const breakdowns = recipeCompositionBreakdownByLineId[line.id] || {};
        hasZeroIngredient = Object.values(breakdowns).some((bd) =>
          bd.lines.some((ing) => Number(ing.avgUnitCostAmount || 0) === 0)
        );
      }
      result[line.id] = { hasZeroCost, hasZeroIngredient };
    }
    return result;
  }, [compositionRows, recipeCompositionBreakdownByLineId]);

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

  useEffect(() => {
    if (navigation.state === "idle" && recalcLoading) {
      setRecalcLoading(false);
    }
  }, [navigation.state, recalcLoading]);

  return (
    <>
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
          <Form method="post" action={detailPath} onSubmit={() => setRecalcLoading(true)}>
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
          <input type="hidden" name="presetId" value={selectedManualPreset?.id || ""} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">Custo manual</h4>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualPreset">Preset</label>
            <SearchableSelect
              value={selectedManualPresetId || "__custom__"}
              onValueChange={(value) => setSelectedManualPresetId(value === "__custom__" ? "" : value)}
              options={manualPresetOptions}
              placeholder="Personalizado"
              searchPlaceholder="Buscar preset..."
              emptyText="Nenhum preset encontrado."
              triggerClassName="h-10 w-full max-w-none justify-between rounded-lg border-slate-200 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
            />
          </div>
          {selectedManualPreset ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Aplicacao automatica: {presetVariationText(selectedManualPreset)}
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualName">Nome</label>
            <input key={`manual-name-${selectedManualPreset?.id || "custom"}`} id="manualName" name="name" defaultValue={selectedManualPreset?.name || ""} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Ex.: Embalagem" required />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnit">Unidade</label>
              <Select key={`manual-unit-${selectedManualPreset?.id || "custom"}`} name="unit" required defaultValue={manualPresetUnit}>
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
              <NumericInput key={`manual-quantity-${selectedManualPreset?.id || "custom"}`} id="manualQuantity" name="quantity" min="0.01" step="0.01" defaultValue={Number(selectedManualPreset?.quantity || 1)} decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnitCostAmount">Custo unit.</label>
              <MoneyInput key={`manual-cost-${selectedManualPreset?.id || "custom"}`} id="manualUnitCostAmount" name="unitCostAmount" defaultValue={Number(selectedManualPreset?.unitCostAmount || 0)} className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualWastePerc">Perda %</label>
              <NumericInput key={`manual-waste-${selectedManualPreset?.id || "custom"}`} id="manualWastePerc" name="wastePerc" min="0" step="0.01" defaultValue={Number(selectedManualPreset?.wastePerc || 0)} decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input key={`manual-notes-${selectedManualPreset?.id || "custom"}`} name="notes" defaultValue={selectedManualPreset?.notes || ""} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-manual" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
              Adicionar custo
            </Button>
          </div>
        </Form>

        <Form method="post" action={detailPath} className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
          <input type="hidden" name="presetId" value={selectedLaborPreset?.id || ""} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Adicionar</div>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">Mao de obra</h4>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborPreset">Preset</label>
            <SearchableSelect
              value={selectedLaborPresetId || "__custom__"}
              onValueChange={(value) => setSelectedLaborPresetId(value === "__custom__" ? "" : value)}
              options={laborPresetOptions}
              placeholder="Personalizado"
              searchPlaceholder="Buscar preset..."
              emptyText="Nenhum preset encontrado."
              triggerClassName="h-10 w-full max-w-none justify-between rounded-lg border-slate-200 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
            />
          </div>
          {selectedLaborPreset ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Aplicacao automatica: {presetVariationText(selectedLaborPreset)}
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborName">Nome</label>
            <input key={`labor-name-${selectedLaborPreset?.id || "custom"}`} id="laborName" name="name" defaultValue={selectedLaborPreset?.name || "Mao de obra"} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnit">Unidade</label>
              <Select key={`labor-unit-${selectedLaborPreset?.id || "custom"}`} name="unit" required defaultValue={laborPresetUnit}>
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
              <NumericInput key={`labor-quantity-${selectedLaborPreset?.id || "custom"}`} id="laborQuantity" name="quantity" min="0.01" step="0.01" defaultValue={Number(selectedLaborPreset?.quantity || 1)} decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnitCostAmount">Custo unit.</label>
              <MoneyInput key={`labor-cost-${selectedLaborPreset?.id || "custom"}`} id="laborUnitCostAmount" name="unitCostAmount" defaultValue={Number(selectedLaborPreset?.unitCostAmount || 0)} className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborWastePerc">Perda %</label>
              <NumericInput key={`labor-waste-${selectedLaborPreset?.id || "custom"}`} id="laborWastePerc" name="wastePerc" min="0" step="0.01" defaultValue={Number(selectedLaborPreset?.wastePerc || 0)} decimalScale={2} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <input key={`labor-notes-${selectedLaborPreset?.id || "custom"}`} name="notes" defaultValue={selectedLaborPreset?.notes || ""} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Observacao opcional" />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-labor" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
              Adicionar mao de obra
            </Button>
          </div>
        </Form>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-slate-50/55 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Presets operacionais</div>
            <div className="mt-1 text-sm text-slate-500">
              Cadastre custos recorrentes e, se quiser, vincule o preset a uma variacao do sistema para aplicar custo automatico so nas colunas compatíveis.
            </div>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {componentPresets.length} presets
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1.45fr]">
          <PresetEditorCard
            detailPath={detailPath}
            unitOptions={unitOptions}
            variationOptions={presetVariationOptions}
            title="Novo preset"
            submitLabel="Salvar preset"
          />

          <div className="space-y-3">
            {componentPresets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                Nenhum preset cadastrado.
              </div>
            ) : (
              componentPresets.map((preset) => (
                <PresetEditorCard
                  key={preset.id}
                  detailPath={detailPath}
                  unitOptions={unitOptions}
                  variationOptions={presetVariationOptions}
                  preset={preset}
                  title={preset.name}
                  submitLabel="Atualizar"
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Composicao da ficha</div>
          <div className="mt-1 text-sm text-slate-500">Edite cada componente por variacao com a mesma leitura visual da grade de precos.</div>
        </div>

        {(() => {
          type AlertEntry = { key: string; label: string; detail: string };
          const alerts: AlertEntry[] = [];

          for (const line of compositionRows) {
            if (line.type !== "recipe" && line.type !== "recipeSheet") continue;

            // top-level zero cost on the sheet row
            const zeroVariations = line.variationValues.filter((v) => Number(v.unitCostAmount || 0) === 0);
            if (zeroVariations.length > 0) {
              const zeroVariationIds = new Set(zeroVariations.map((v) => v.itemVariationId));
              const labels = (variationSheets as any[])
                .filter((sheet) => zeroVariationIds.has(String(sheet.itemVariationId || "")))
                .map((sheet) => variationLabel(sheet))
                .join(", ");
              alerts.push({
                key: `${line.id}-zero`,
                label: line.name,
                detail: labels ? `custo zero · ${labels}` : "custo zero",
              });
            }

            // zero-cost ingredients inside recipe breakdowns
            if (line.type === "recipe") {
              const breakdownsByVariation = recipeCompositionBreakdownByLineId[line.id] || {};
              const zeroIngredientNames = new Set<string>();
              for (const breakdown of Object.values(breakdownsByVariation)) {
                for (const ing of breakdown.lines || []) {
                  if (Number(ing.avgUnitCostAmount || 0) === 0) {
                    zeroIngredientNames.add(ing.itemName);
                  }
                }
              }
              for (const ingredientName of zeroIngredientNames) {
                alerts.push({
                  key: `${line.id}-ing-${ingredientName}`,
                  label: line.name,
                  detail: `ingrediente sem custo: ${ingredientName}`,
                });
              }
            }
          }

          if (alerts.length === 0) return null;
          return (
            <div className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Componentes com custo zero</div>
                  <ul className="mt-1 space-y-0.5">
                    {alerts.map((alert) => (
                      <li key={alert.key} className="text-xs text-amber-800">
                        <span className="font-semibold">{alert.label}</span>
                        <span className="text-amber-600"> · {alert.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

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
                  const recipeHref = line.type === "recipe" && line.refId ? `/admin/recipes/${line.refId}` : null;
                  const lineFormId = `line-form-${line.id}`;

                  return (
                    <tr key={line.id}>
                      <td className="sticky left-0 z-10 min-w-[280px] border-t border-slate-100 bg-white px-3 py-4 align-top">
                        <Form id={lineFormId} method="post" action={detailPath} className="space-y-2">
                          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
                          <div className="pb-1 flex items-center gap-2">
                            <SheetTypeLabel type={line.type} />
                            {line.presetName ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {line.presetName}
                              </span>
                            ) : null}
                            {(rowAlerts[line.id]?.hasZeroCost || rowAlerts[line.id]?.hasZeroIngredient) ? (
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nome</label>
                            {recipeHref ? (
                              <>
                                <input type="hidden" name="name" value={line.name} />
                                <Link
                                  to={recipeHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-9 w-full items-center rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm text-slate-700 transition hover:border-blue-200 hover:text-blue-700 hover:underline"
                                  title="Abrir receita em nova aba"
                                >
                                  <span className="truncate">{line.name}</span>
                                </Link>
                              </>
                            ) : (
                              <input
                                name="name"
                                defaultValue={line.name}
                                readOnly={refLocked}
                                className={`h-9 w-full rounded-lg border px-3 text-sm ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`}
                              />
                            )}
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
                        const isZeroRefCost = refLocked && Number(value?.unitCostAmount || 0) === 0;
                        return (
                          <td key={sheet.id} className="min-w-[292px] border-t border-slate-100 px-3 py-4 align-top">
                            <div className={`rounded-[22px] border p-3 ${isZeroRefCost ? "border-amber-300 bg-amber-50/70" : "border-slate-200 bg-slate-50/65"}`}>
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
                                  {line.type === "recipe" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedRecipeBreakdownTarget({
                                          lineId: line.id,
                                          itemVariationId: String(sheet.itemVariationId || ""),
                                        })
                                      }
                                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                                      title="Ver composicao usada no calculo"
                                    >
                                      {formatCompactMoney(Number(value?.totalCostAmount || 0))}
                                    </button>
                                  ) : (
                                    <NumericInput
                                      defaultValue={Number(value?.totalCostAmount || 0).toFixed(2)}
                                      decimalScale={2}
                                      readOnly
                                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-right text-slate-700"
                                    />
                                  )}
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
    <Dialog open={recalcLoading} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm rounded-2xl p-8 [&>button]:hidden">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <div>
            <DialogTitle className="text-base font-semibold text-slate-900">Recalculando ficha</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              Atualizando custos com base nas receitas e ingredientes. Aguarde...
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog
      open={Boolean(selectedRecipeBreakdownTarget)}
      onOpenChange={(open) => {
        if (!open) setSelectedRecipeBreakdownTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-base font-semibold text-slate-950">
            Composicao da receita
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {selectedRecipeBreakdown?.recipeName || selectedRecipeLine?.name || "Receita"}
            {selectedVariationLabel ? ` · ${selectedVariationLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custo base da receita</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {formatMoney(Number(selectedRecipeBreakdown?.unitCostAmount || 0))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quantidade na ficha</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {formatQuantity(Number(selectedRecipeValue?.quantity || 0), 2)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Perda aplicada</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {formatQuantity(Number(selectedRecipeValue?.wastePerc || 0), 2)}%
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total da linha</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-900">
                {formatMoney(Number(selectedRecipeValue?.totalCostAmount || 0))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ingrediente</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qtd.</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qtd. bruta</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Perda</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custo un.</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {(selectedRecipeBreakdown?.lines || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                      Nenhum ingrediente encontrado para esta variacao da receita.
                    </td>
                  </tr>
                ) : (
                  (selectedRecipeBreakdown?.lines || []).map((ingredient) => (
                    <tr key={ingredient.ingredientId}>
                      <td className="border-b border-slate-100 px-3 py-3 align-top">
                        <div className="font-medium text-slate-900">{ingredient.itemName}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {[ingredient.ingredientVariationLabel, ingredient.unit].filter(Boolean).join(" · ")}
                        </div>
                        {ingredient.notes ? (
                          <div className="mt-1 text-xs text-slate-400">{ingredient.notes}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right font-mono text-slate-700">
                        {formatQuantity(ingredient.quantity)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right font-mono text-slate-700">
                        {formatQuantity(ingredient.grossQuantity)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right font-mono text-slate-700">
                        {formatQuantity(ingredient.lossPct, 2)}%
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right font-mono text-slate-700">
                        {formatMoney(ingredient.avgUnitCostAmount)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatMoney(ingredient.totalCostAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function PresetEditorCard(props: {
  detailPath: string;
  unitOptions: string[];
  variationOptions: SearchableSelectOption[];
  preset?: {
    id: string;
    key: string;
    type: string;
    variationId: string | null;
    variationLabel?: string | null;
    variationCode?: string | null;
    variationKind?: string | null;
    name: string;
    unit?: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
    notes?: string | null;
  };
  title: string;
  submitLabel: string;
}) {
  const {
    detailPath,
    unitOptions,
    variationOptions,
    preset,
    title,
    submitLabel,
  } = props;
  const [selectedVariationId, setSelectedVariationId] = useState(preset?.variationId || "__all__");
  const defaultUnit = preset?.unit && unitOptions.includes(String(preset.unit).toUpperCase())
    ? String(preset.unit).toUpperCase()
    : (unitOptions.includes("UN") ? "UN" : unitOptions[0] || "");
  const isExisting = Boolean(preset?.id);
  const variationSummary = presetVariationText(preset);

  useEffect(() => {
    setSelectedVariationId(preset?.variationId || "__all__");
  }, [preset?.variationId]);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <Form method="post" action={detailPath} className="space-y-3">
        <input type="hidden" name="redirectTo" value={`${detailPath}/custos`} />
        <input type="hidden" name="presetId" value={preset?.id || ""} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {isExisting ? (
              <div className="mt-1 text-xs text-slate-500">
                Chave: <span className="font-mono">{preset?.key}</span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-500">Crie um preset reutilizável para custo manual ou mão de obra.</div>
            )}
          </div>
          {isExisting ? (
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {preset?.type === "labor" ? "Mao de obra" : "Custo manual"}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-[140px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
            <Select name="type" defaultValue={preset?.type || "manual"}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Custo manual</SelectItem>
                <SelectItem value="labor">Mao de obra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</label>
            <input
              name="name"
              defaultValue={preset?.name || ""}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: Embalagem borda recheada"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variacao vinculada</label>
          <input type="hidden" name="variationId" value={selectedVariationId === "__all__" ? "" : selectedVariationId} />
          <SearchableSelect
            value={selectedVariationId}
            onValueChange={setSelectedVariationId}
            options={variationOptions}
            placeholder="Todas as variacoes da ficha"
            searchPlaceholder="Buscar variacao..."
            emptyText="Nenhuma variacao encontrada."
            triggerClassName="h-10 w-full max-w-none justify-between rounded-lg border-slate-200 px-3 text-sm"
            contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
          />
          <div className="mt-1 text-xs text-slate-500">
            {isExisting ? `Aplicacao atual: ${variationSummary}` : "Quando vinculada, o custo entra automaticamente apenas nas colunas dessa variacao."}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</label>
            <Select name="unit" defaultValue={defaultUnit}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white">
                <SelectValue />
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
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</label>
            <NumericInput
              name="quantity"
              min="0.01"
              step="0.01"
              defaultValue={Number(preset?.quantity || 1)}
              decimalScale={2}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Custo unit.</label>
            <MoneyInput
              name="unitCostAmount"
              defaultValue={Number(preset?.unitCostAmount || 0)}
              className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Perda %</label>
            <NumericInput
              name="wastePerc"
              min="0"
              step="0.01"
              defaultValue={Number(preset?.wastePerc || 0)}
              decimalScale={2}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <input
          name="notes"
          defaultValue={preset?.notes || ""}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Observacao opcional"
        />

        <div className="flex flex-wrap justify-between gap-2">
          {isExisting ? (
            <Button
              type="submit"
              variant="outline"
              name="_action"
              value="item-cost-sheet-preset-delete"
              className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              Remover
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            variant="outline"
            name="_action"
            value={isExisting ? "item-cost-sheet-preset-update" : "item-cost-sheet-preset-create"}
            className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            {submitLabel}
          </Button>
        </div>
      </Form>
    </div>
  );
}
