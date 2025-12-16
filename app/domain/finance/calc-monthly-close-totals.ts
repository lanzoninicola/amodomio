import { FinancialMonthlyClose } from "@prisma/client";

export type MonthlyCloseTotals = {
  receitaBruta: number;
  receitaLiquida: number;
  custoFixoTotal: number;
  custoVariavelTotal: number;
  margemContrib: number;
  margemContribPerc: number;
  resultadoLiquido: number;
  resultadoLiquidoPercBruta: number;
  pontoEquilibrio: number;
};

export function calcMonthlyCloseTotals(
  c?: Partial<FinancialMonthlyClose> | null,
): MonthlyCloseTotals {
  if (!c) {
    return {
      receitaBruta: 0,
      receitaLiquida: 0,
      custoFixoTotal: 0,
      custoVariavelTotal: 0,
      margemContrib: 0,
      margemContribPerc: 0,
      resultadoLiquido: 0,
      resultadoLiquidoPercBruta: 0,
      pontoEquilibrio: 0,
    };
  }

  const receitaExtrato = (c as any).receitaExtratoBancoAmount ?? 0;
  const receitaDinheiro = (c as any).receitaDinheiroAmount ?? 0;
  const receitaBrutaParts = receitaExtrato + receitaDinheiro;
  const receitaBruta = receitaBrutaParts > 0 ? receitaBrutaParts : c.receitaBrutaAmount ?? 0;
  const vendaCartaoAmount = c.vendaCartaoAmount ?? 0;
  const taxaCartaoPerc = c.taxaCartaoPerc ?? 0;
  const vendaCartaoPerc = receitaBruta > 0 ? (vendaCartaoAmount / receitaBruta) * 100 : 0;
  const receitaBrutaCartao = receitaBruta > 0 ? (receitaBruta * vendaCartaoPerc) / 100 : 0;
  const taxaCartaoAmount = receitaBrutaCartao > 0 ? (receitaBrutaCartao * taxaCartaoPerc) / 100 : 0;

  const vendaMarketplaceAmount = c.vendaMarketplaceAmount ?? 0;
  const taxaMarketplacePerc = c.taxaMarketplacePerc ?? 0;
  const taxaMarketplaceAmount = vendaMarketplaceAmount > 0
    ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100
    : 0;

  const impostoAmountRaw = (c as any).custoVariavelImpostosAmount ?? c.impostoAmount;
  const impostoAmountPerc = receitaBruta > 0 ? (receitaBruta * (c.impostoPerc ?? 0)) / 100 : 0;
  const impostoAmount = impostoAmountRaw ?? impostoAmountPerc;

  const receitaLiquidaCalculated = receitaBruta - taxaCartaoAmount - impostoAmount - taxaMarketplaceAmount;
  const receitaLiquida = (c.receitaLiquidaAmount ?? 0) || receitaLiquidaCalculated;

  const custoFixoTotal =
    c.custoFixoTotalAmount ??
    ((c.custoFixoFolhaAmount ?? 0) + // aqui passa a representar plano de saúde
      (c.custoFixoFolhaFuncionariosAmount ?? 0) +
      (c.custoFixoProlaboreAmount ?? 0) +
      (c.custoFixoRetiradaProlaboreAmount ?? c.custoFixoRetiradaLucroAmount ?? 0) +
      (c.custoFixoRetiradaResultadoAmount ?? 0) +
      (c.custoFixoAssessoriaMarketingAmount ?? 0) +
      (c.custoVariavelMarketingAmount ?? 0) +
      (c.custoFixoFaturaCartaoAmount ?? 0) +
      (c.custoFixoParcelaFinanciamentoAmount ?? 0) +
      (c.custoFixoOutrosAmount ?? 0));

  const custoVariavelTotal =
    c.custoVariavelTotalAmount ??
    ((c.custoVariavelInsumosAmount ?? 0) +
      (c.custoVariavelEntregaAmount ?? 0) +
      (c.custoVariavelImpostosAmount ?? 0) +
      (c.custoVariavelOutrosAmount ?? 0));

  const margemContrib =
    c.margemContribAmount ??
    receitaBruta - custoVariavelTotal;
  const margemContribPerc =
    c.margemContribPerc ??
    (receitaBruta > 0 ? (margemContrib / receitaBruta) * 100 : 0);

  const resultadoLiquido =
    c.resultadoLiquidoAmount ??
    margemContrib - custoFixoTotal;
  const resultadoLiquidoPercBruta =
    c.resultadoLiquidoPerc ??
    (receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0);

  const varPerc = receitaBruta > 0 ? custoVariavelTotal / receitaBruta : 0;
  const pontoEquilibrio = receitaBruta > 0 && (1 - varPerc) !== 0
    ? custoFixoTotal / (1 - varPerc)
    : c.pontoEquilibrioAmount ?? 0;

  return {
    receitaBruta,
    receitaLiquida,
    custoFixoTotal,
    custoVariavelTotal,
    margemContrib,
    margemContribPerc,
    resultadoLiquido,
    resultadoLiquidoPercBruta,
    pontoEquilibrio,
  };
}
