export default function formatDecimalPlaces(
  value: number,
  decimalNumber: number = 2
): number {
  if (isNaN(value)) {
    return 0;
  }
  return Number(value.toFixed(decimalNumber));
}
