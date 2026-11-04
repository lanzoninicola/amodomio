import { calculateRecipeScaleFromIngredient } from "~/domain/recipe/recipe-scaling";

export type ProductionRecipeIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type ProductionRecipePreparation = {
  id: string;
  name: string;
  notes?: string | null;
  ingredients: Array<{ recipeIngredientId: string; quantity: number }>;
};

export type ProductionPlanLine = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type ProductionPlanPreparation = {
  id: string;
  name: string;
  notes: string | null;
  ingredients: ProductionPlanLine[];
};

export type ProductionPlan = {
  version: 1;
  scaleFactor: number;
  totals: ProductionPlanLine[];
  preparations: ProductionPlanPreparation[];
  final: {
    preparedItems: string[];
    ingredients: ProductionPlanLine[];
  };
  inconsistencies: string[];
};

const EPSILON = 1e-6;

export function calculateProductionPlan(params: {
  ingredients: ProductionRecipeIngredient[];
  preparations: ProductionRecipePreparation[];
  baseIngredientId: string;
  baseQuantity: number;
}): ProductionPlan {
  const base = params.ingredients.find((i) => i.id === params.baseIngredientId);
  if (!base) throw new Error("Ingrediente-base não encontrado na receita.");
  const scaleFactor = calculateRecipeScaleFromIngredient({
    baseQuantity: base.quantity,
    availableQuantity: params.baseQuantity,
  });
  if (!scaleFactor)
    throw new Error("Informe uma quantidade-base maior que zero.");

  const totals = params.ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    quantity: i.quantity * scaleFactor,
  }));
  const byId = new Map(totals.map((t) => [t.id, t]));
  const used = new Map<string, number>();
  const inconsistencies: string[] = [];

  const preparations = params.preparations.map((preparation) => ({
    id: preparation.id,
    name: preparation.name,
    notes: preparation.notes ?? null,
    ingredients: preparation.ingredients
      .filter((line) => line.quantity > 0 && byId.has(line.recipeIngredientId))
      .map((line) => {
        const total = byId.get(line.recipeIngredientId)!;
        const quantity = line.quantity * scaleFactor;
        used.set(total.id, (used.get(total.id) ?? 0) + quantity);
        return { id: total.id, name: total.name, unit: total.unit, quantity };
      }),
  }));

  for (const total of totals) {
    const consumed = used.get(total.id) ?? 0;
    if (consumed > total.quantity + EPSILON)
      inconsistencies.push(
        `${total.name}: preparações usam mais que o total da receita.`
      );
  }

  const remaining = totals
    .map((t) => ({
      ...t,
      quantity: Math.max(0, t.quantity - (used.get(t.id) ?? 0)),
    }))
    .filter((t) => t.quantity > EPSILON);

  return {
    version: 1,
    scaleFactor,
    totals,
    preparations,
    final: {
      preparedItems: preparations.map((p) => p.name),
      ingredients: remaining,
    },
    inconsistencies,
  };
}

const CONVERSIONS: Record<string, { group: string; factor: number }> = {
  G: { group: "mass", factor: 1 },
  KG: { group: "mass", factor: 1000 },
  ML: { group: "volume", factor: 1 },
  L: { group: "volume", factor: 1000 },
};

/** Converte quantidade entre unidades compatíveis (g/kg, ml/l). Retorna null se incompatível. */
export function convertQuantity(value: number, from: string, to: string) {
  const a = from.toUpperCase();
  const b = to.toUpperCase();
  if (a === b) return value;
  const ca = CONVERSIONS[a];
  const cb = CONVERSIONS[b];
  if (!ca || !cb || ca.group !== cb.group) return null;
  return (value * ca.factor) / cb.factor;
}

/** Unidades de entrada oferecidas para a unidade da receita. */
export function compatibleUnits(unit: string) {
  const c = CONVERSIONS[unit.toUpperCase()];
  if (!c) return [unit.toUpperCase()];
  return Object.entries(CONVERSIONS)
    .filter(([, v]) => v.group === c.group)
    .map(([k]) => k)
    .sort((x, y) => CONVERSIONS[x].factor - CONVERSIONS[y].factor);
}

/** Formata para exibição operacional: 0,5 kg → "500 g", 2,5 kg → "2,5 kg". */
export function formatProductionQuantity(quantity: number, unit: string) {
  let value = quantity;
  let u = unit.toUpperCase();
  if (u === "KG" && value < 1) {
    value *= 1000;
    u = "g";
  } else if (u === "L" && value < 1) {
    value *= 1000;
    u = "ml";
  } else if (u === "G" && value >= 1000) {
    value /= 1000;
    u = "kg";
  } else if (u === "ML" && value >= 1000) {
    value /= 1000;
    u = "L";
  } else if (u === "G" || u === "ML") u = u.toLowerCase();
  else if (u === "KG") u = "kg";
  const text = value
    .toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 2 : 1 });
  return { value: text, unit: u };
}
