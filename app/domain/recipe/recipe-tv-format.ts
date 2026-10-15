export function formatRecipeTvNumber(value: number, showDecimals = true) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
}
