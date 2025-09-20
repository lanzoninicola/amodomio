export function normalizeBRPhone(input: string | null | undefined) {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// Parse "DD/MM/YYYY HH:mm:ss" seguro
export function parseBrDateTime(
  dateDDMMYYYY?: string | null,
  timeHHMMSS?: string | null
): Date | null {
  if (!dateDDMMYYYY || !timeHHMMSS) return null;
  const [d, m, y] = dateDDMMYYYY.split("/");
  if (!d || !m || !y) return null;
  const iso = `${y}-${m}-${d}T${timeHHMMSS}`;
  const dt = new Date(iso);
  return isNaN(dt.valueOf()) ? null : dt;
}
