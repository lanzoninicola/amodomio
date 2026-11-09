// app/domain/finance/compute-net-revenue-amount.ts
export type NetRevenueAmountInput = {
  receitaBrutaAmount: number; // R$
  vendaCartaoAmount: number; // R$ (quanto do bruto foi pago em cartão)
  taxaCartaoPerc: number; // % aplicada sobre a parte do bruto paga no cartão
  impostoPerc: number; // % sobre a receita bruta
  vendaMarketplaceAmount: number; // R$ vindo de marketplace
  taxaMarketplacePerc: number; // % sobre vendas de marketplace
};

/**
 * Receita Líquida = Bruta - TaxaCartão - Imposto - TaxaMarketplace
 */
export function computeNetRevenueAmount(i: NetRevenueAmountInput): number {
  const rba = safe(i.receitaBrutaAmount);

  // % de cartão sobre o bruto
  const vendaCartaoPerc = rba > 0 ? (safe(i.vendaCartaoAmount) / rba) * 100 : 0;

  // taxa sobre a parte do bruto que foi paga no cartão
  const receitaBrutaCartao = rba > 0 ? (rba * vendaCartaoPerc) / 100 : 0;
  const taxaCartaoAmount =
    receitaBrutaCartao > 0
      ? (receitaBrutaCartao * safe(i.taxaCartaoPerc)) / 100
      : 0;

  // imposto sobre o bruto
  const impostoAmount = rba > 0 ? (rba * safe(i.impostoPerc)) / 100 : 0;

  // taxa sobre o valor vindo de marketplace
  const taxaMarketplaceAmount =
    safe(i.vendaMarketplaceAmount) > 0
      ? (safe(i.vendaMarketplaceAmount) * safe(i.taxaMarketplacePerc)) / 100
      : 0;

  // receita líquida
  return rba - taxaCartaoAmount - impostoAmount - taxaMarketplaceAmount;
}

function safe(v: number): number {
  return Number.isFinite(v) ? v : 0;
}
