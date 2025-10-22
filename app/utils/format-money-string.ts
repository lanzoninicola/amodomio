export default function formatMoneyString(
  value: number | string | undefined,
  fractionDigits: number = 2
): string {
  if (!value) return String(0);

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
