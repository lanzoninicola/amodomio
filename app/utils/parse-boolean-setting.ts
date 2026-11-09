export function parseBooleanSetting(
  value: string | null | undefined,
  fallback: boolean
): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(normalized)) return true;
  if (["false", "0", "no", "nao"].includes(normalized)) return false;

  return fallback;
}
