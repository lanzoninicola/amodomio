type TemplateIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
};

type TemplateSource = {
  name: string;
  costingMode: string;
  yieldQuantity: number | null;
  yieldUnit: string | null;
  ingredients: Array<
    TemplateIngredient & {
      preferredUnit?: string | null;
      displayUnits?: Array<{ unit: string; factor: number }>;
    }
  >;
};

export type RecipeTemplateSnapshot = {
  version: 1;
  recipeName: string;
  scaleFactor: number;
  yieldQuantity: number | null;
  yieldUnit: string | null;
  ingredients: TemplateIngredient[];
};

export function getRecipeTemplateIngredient(
  ingredient: TemplateSource["ingredients"][number],
  scaleFactor: number,
  selectedUnit = ingredient.unit
): TemplateIngredient {
  const conversion =
    selectedUnit === ingredient.unit
      ? { unit: ingredient.unit, factor: 1 }
      : ingredient.displayUnits?.find(({ unit }) => unit === selectedUnit);
  if (
    !conversion ||
    !Number.isFinite(conversion.factor) ||
    conversion.factor <= 0
  ) {
    throw new Error(
      `Unidade inválida para ${ingredient.name}. Selecione novamente a unidade.`
    );
  }
  const quantity =
    Number(ingredient.quantity) * conversion.factor * scaleFactor;
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("A receita contém uma quantidade inválida.");
  }
  return {
    id: ingredient.id,
    name: ingredient.name,
    quantity,
    unit: conversion.unit,
    notes: ingredient.notes,
  };
}

export function createRecipeTemplateSnapshot(
  recipe: TemplateSource,
  scaleFactor: number,
  selectedUnits: Record<string, string> = {}
): RecipeTemplateSnapshot {
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    throw new Error("Informe quantidades válidas antes de criar o template.");
  }
  if (!recipe.ingredients.length) {
    throw new Error("Cadastre ingredientes antes de criar um template.");
  }
  const ingredients = recipe.ingredients.map((ingredient) =>
    getRecipeTemplateIngredient(
      ingredient,
      scaleFactor,
      selectedUnits[ingredient.id] ||
        ingredient.preferredUnit ||
        ingredient.unit
    )
  );
  const yieldQuantity =
    recipe.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity) * scaleFactor
      : null;
  if (yieldQuantity !== null && !Number.isFinite(yieldQuantity)) {
    throw new Error("O rendimento ajustado é inválido.");
  }
  return {
    version: 1,
    recipeName: recipe.name,
    scaleFactor,
    yieldQuantity,
    yieldUnit: recipe.yieldUnit,
    ingredients,
  };
}

export function applyTemplateUnitPreference(
  saved: TemplateIngredient,
  current: TemplateSource["ingredients"][number] | undefined,
  selectedUnit = current?.preferredUnit
): TemplateIngredient {
  if (!current || !selectedUnit || selectedUnit === saved.unit) return saved;
  const unitFactor = (unit: string) =>
    unit === current.unit
      ? 1
      : current.displayUnits?.find((entry) => entry.unit === unit)?.factor;
  const fromFactor = unitFactor(saved.unit);
  const toFactor = unitFactor(selectedUnit);
  if (
    !fromFactor ||
    !toFactor ||
    fromFactor <= 0 ||
    toFactor <= 0 ||
    !Number.isFinite(fromFactor) ||
    !Number.isFinite(toFactor)
  )
    return saved;
  const quantity = (saved.quantity / fromFactor) * toFactor;
  return Number.isFinite(quantity)
    ? { ...saved, quantity, unit: selectedUnit }
    : saved;
}

export function getTemplateIngredientDisplayUnits(
  saved: TemplateIngredient,
  current: TemplateSource["ingredients"][number] | undefined
) {
  if (!current) return [saved.unit];
  const candidates = new Set([
    saved.unit,
    current.unit,
    ...(current.displayUnits || []).map((entry) => entry.unit),
  ]);
  return [...candidates].filter(
    (unit) =>
      unit === saved.unit ||
      applyTemplateUnitPreference(saved, current, unit).unit === unit
  );
}
