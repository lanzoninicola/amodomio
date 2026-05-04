import { Form, Link } from "@remix-run/react";
import { useEffect, useState } from "react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Button } from "~/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

type ItemCostSheetPresetFormProps = {
  action: string;
  cancelHref?: string;
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
  } | null;
  unitOptions: string[];
  variationOptions: SearchableSelectOption[];
  submitLabel: string;
  deleteLabel?: string;
};

function presetVariationText(preset: ItemCostSheetPresetFormProps["preset"]) {
  if (!preset?.variationLabel) return "Todas as variacoes da ficha";
  const parts = [preset.variationLabel, preset.variationCode, preset.variationKind].filter(Boolean);
  return parts.join(" · ");
}

export function ItemCostSheetPresetForm(props: ItemCostSheetPresetFormProps) {
  const {
    action,
    cancelHref,
    preset,
    unitOptions,
    variationOptions,
    submitLabel,
    deleteLabel = "Remover",
  } = props;
  const [selectedVariationId, setSelectedVariationId] = useState(preset?.variationId || "__all__");
  const defaultUnit = preset?.unit && unitOptions.includes(String(preset.unit).toUpperCase())
    ? String(preset.unit).toUpperCase()
    : (unitOptions.includes("UN") ? "UN" : unitOptions[0] || "");

  useEffect(() => {
    setSelectedVariationId(preset?.variationId || "__all__");
  }, [preset?.variationId]);

  return (
    <Form method="post" action={action} className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5">
      <input type="hidden" name="presetId" value={preset?.id || ""} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {preset ? "Editar preset" : "Novo preset"}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">
            {preset?.name || "Preset operacional"}
          </div>
          {preset ? (
            <div className="mt-1 text-xs text-slate-500">
              Chave: <span className="font-mono">{preset.key}</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-slate-500">
              Cadastre um custo recorrente para reutilizar nas fichas.
            </div>
          )}
        </div>
        {preset ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {preset.type === "labor" ? "Mao de obra" : "Custo manual"}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
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
          {preset
            ? `Aplicacao atual: ${presetVariationText(preset)}`
            : "Quando vinculada, o custo automatico entra apenas nas colunas dessa variacao."}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Observacao</label>
        <input
          name="notes"
          defaultValue={preset?.notes || ""}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Observacao opcional"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {cancelHref ? (
            <Button asChild type="button" variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link to={cancelHref}>Voltar</Link>
            </Button>
          ) : null}
          {preset ? (
            <Button
              type="submit"
              variant="outline"
              name="_action"
              value="item-cost-sheet-preset-delete"
              className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              {deleteLabel}
            </Button>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="outline"
          name="_action"
          value={preset ? "item-cost-sheet-preset-update" : "item-cost-sheet-preset-create"}
          className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}
