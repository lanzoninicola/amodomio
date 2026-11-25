/** Número visível na Suitable; o ID interno nunca serve de fallback. */
export function suitableDisplayNumber(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = String(value).trim().replace(/^#\s*/, "");
  return number || null;
}

/** Número que será gravado em commandNumber no registro do KDS. */
export function suitableCommandNumber(value: unknown): number | null {
  const display = suitableDisplayNumber(value);
  if (!display || !/^\d+$/.test(display)) return null;
  const number = Number(display);
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : null;
}
