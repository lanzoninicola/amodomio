export type UsageFilter = "all" | "1" | "2" | "3";
export type RecipeTabFilter = "visible" | "future";

export const INGREDIENT_FLAVOR_BASE_PATH = "/admin/vendas/ingredientes-sabores";

export const RECIPE_TABS: Array<{
  value: RecipeTabFilter;
  label: string;
  dotClassName: string;
  activeClassName: string;
}> = [
  {
    value: "visible",
    label: "Visiveis no canal",
    dotClassName: "bg-emerald-500",
    activeClassName: "border-emerald-600 text-emerald-900",
  },
  {
    value: "future",
    label: "Lancamentos futuros",
    dotClassName: "bg-amber-400",
    activeClassName: "border-amber-500 text-amber-900",
  },
];

export type SellingChannelOption = {
  id: string;
  key: string;
  name: string;
};

export type FlavorUsage = {
  itemId: string;
  itemName: string;
  variationName: string | null;
  recipeName: string | null;
  quantity: number | null;
  unit: string | null;
};

export type IngredientRankingRow = {
  ingredientId: string;
  ingredientName: string;
  classification: string;
  active: boolean;
  usageCount: number;
  recipeCount: number;
  variationCount: number;
  flavors: FlavorUsage[];
};

export type IngredientFlavorUsagePayload = {
  filters: {
    q: string;
    usage: UsageFilter;
    channel: string;
    tab: RecipeTabFilter;
  };
  channels: SellingChannelOption[];
  tabCounts: Record<RecipeTabFilter, number>;
  rows: IngredientRankingRow[];
  summary: {
    flavorItems: number;
    flavorVariations: number;
    ingredients: number;
    leastUsedIngredients: number;
  };
};

export function formatClassification(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

export function getIngredientBadgeLabel(row: IngredientRankingRow) {
  return row.usageCount === 1 ? "isolado" : "baixo uso";
}

export function getIngredientBadgeClass(row: IngredientRankingRow) {
  if (row.usageCount <= 1) return "border-red-200 bg-red-50 text-red-700";
  if (row.usageCount <= 2) return "border-amber-200 bg-amber-50 text-amber-700";
  if (row.usageCount <= 3) return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getIngredientCardClass(row: IngredientRankingRow) {
  if (row.usageCount <= 1) return "border-red-200 bg-red-50/80 hover:border-red-300";
  if (row.usageCount <= 2) return "border-amber-200 bg-amber-50/80 hover:border-amber-300";
  if (row.usageCount <= 3) return "border-sky-200 bg-sky-50/80 hover:border-sky-300";
  return "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300";
}

export function buildIngredientFlavorHref(params: {
  view?: "cards" | "lista";
  q: string;
  usage: UsageFilter;
  channel: string;
  tab: RecipeTabFilter;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.usage !== "all") searchParams.set("usage", params.usage);
  if (params.channel && params.channel !== "cardapio") searchParams.set("channel", params.channel);
  if (params.tab !== "visible") searchParams.set("tab", params.tab);
  const suffix = searchParams.toString();
  const path = `${INGREDIENT_FLAVOR_BASE_PATH}/${params.view || "lista"}`;
  return suffix ? `${path}?${suffix}` : path;
}
