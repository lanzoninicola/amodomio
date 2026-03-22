export const ITEM_COST_SOURCE_VALUES = [
  "manual",
  "purchase",
  "import",
  "adjustment",
  "item-cost-sheet",
] as const;

export type ItemCostSource = (typeof ITEM_COST_SOURCE_VALUES)[number];

export type ItemCostSourceOption = {
  value: ItemCostSource;
  label: string;
  hint: string;
};

export const ITEM_COST_SOURCE_OPTIONS: ItemCostSourceOption[] = [
  {
    value: "manual",
    label: "Manual",
    hint: "Levantamento digitado/manual.",
  },
  {
    value: "purchase",
    label: "Compra",
    hint: "Custo confirmado em compra.",
  },
  {
    value: "import",
    label: "Importação de movimentações",
    hint: "Custo vindo de importação de estoque por documento.",
  },
  {
    value: "adjustment",
    label: "Ajuste",
    hint: "Ajuste operacional.",
  },
  {
    value: "item-cost-sheet",
    label: "Ficha de custo",
    hint: "Valor calculado por ficha de custo.",
  },
];

export function getItemCostSourceLabel(source: string | null | undefined) {
  const normalized = String(source || "").trim().toLowerCase();
  return ITEM_COST_SOURCE_OPTIONS.find((option) => option.value === normalized)?.label || normalized || "manual";
}

export function getItemCostSourceHint(source: string | null | undefined) {
  const normalized = String(source || "").trim().toLowerCase();
  return ITEM_COST_SOURCE_OPTIONS.find((option) => option.value === normalized)?.hint || null;
}
