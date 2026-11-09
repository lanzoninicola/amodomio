// Compat layer: use the browser-safe module so routes can import without SSR/client split issues.
export type { NetRevenueAmountInput } from "./compute-net-revenue-amount";
export { computeNetRevenueAmount } from "./compute-net-revenue-amount";
