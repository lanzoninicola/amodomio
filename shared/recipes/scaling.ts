function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateRecipeScaleFromYield(params: {
  baseYield: number;
  desiredYield: number;
}) {
  const baseYield = positiveNumber(params.baseYield);
  const desiredYield = positiveNumber(params.desiredYield);
  if (!baseYield || !desiredYield) return 1;
  return desiredYield / baseYield;
}

export function calculateRecipeScaleFromIngredient(params: {
  baseQuantity: number;
  availableQuantity: number;
}) {
  const baseQuantity = positiveNumber(params.baseQuantity);
  const availableQuantity = positiveNumber(params.availableQuantity);
  if (!baseQuantity || !availableQuantity) return null;
  return availableQuantity / baseQuantity;
}

export function scaleRecipeQuantity(quantity: number, scaleFactor: number) {
  const normalizedQuantity = Number(quantity);
  const normalizedScale = positiveNumber(scaleFactor);
  if (!Number.isFinite(normalizedQuantity) || !normalizedScale) return 0;
  return normalizedQuantity * normalizedScale;
}
