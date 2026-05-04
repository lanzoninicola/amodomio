import { useMemo } from "react";
import { useOutletContext } from "@remix-run/react";
import type { SearchableSelectOption } from "~/components/ui/searchable-select";
import { ItemCostSheetPresetForm } from "~/components/admin/item-cost-sheet-preset-form";
import type { ItemCostSheetPresetsOutletContext } from "./admin.item-cost-sheets.presets";

export default function AdminItemCostSheetPresetsNew() {
  const { variations, unitOptions } = useOutletContext<ItemCostSheetPresetsOutletContext>();

  const variationOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: "__all__",
        label: "Todas as variacoes da ficha",
        searchText: "todas variacoes ficha geral",
      },
      ...variations.map((variation) => ({
        value: variation.id,
        label: variation.name,
        searchText: [variation.name, variation.code, variation.kind].filter(Boolean).join(" "),
      })),
    ],
    [variations]
  );

  return (
    <ItemCostSheetPresetForm
      action="/admin/item-cost-sheets/presets"
      cancelHref="/admin/item-cost-sheets/presets"
      unitOptions={unitOptions}
      variationOptions={variationOptions}
      submitLabel="Salvar preset"
    />
  );
}
