import type { FinancialMonthlyClose } from "@prisma/client";

import { calcMonthlyCloseTotals } from "./calc-monthly-close-totals";

export type WeightedCostPerc = {
  receitaBrutaTotal: number;
  custoFixoPerc: number;
  custoVariavelPerc: number;
};

export function calcWeightedCostPerc(
  closes: Array<Partial<FinancialMonthlyClose> | null | undefined>,
): WeightedCostPerc {
  let receitaBrutaTotal = 0;
  let custoFixoTotal = 0;
  let custoVariavelTotal = 0;

  closes.forEach((close) => {
    if (!close) return;
    const totals = calcMonthlyCloseTotals(close);
    receitaBrutaTotal += totals.receitaBruta || 0;
    custoFixoTotal += totals.custoFixoTotal || 0;
    custoVariavelTotal += totals.custoVariavelTotal || 0;
  });

  if (receitaBrutaTotal <= 0) {
    return {
      receitaBrutaTotal: 0,
      custoFixoPerc: 0,
      custoVariavelPerc: 0,
    };
  }

  return {
    receitaBrutaTotal,
    custoFixoPerc: (custoFixoTotal / receitaBrutaTotal) * 100,
    custoVariavelPerc: (custoVariavelTotal / receitaBrutaTotal) * 100,
  };
}
