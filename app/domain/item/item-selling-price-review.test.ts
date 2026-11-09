import { describe, expect, it } from "vitest";
import {
  calculateBreakEvenComposition,
  calculateSellingPriceProfit,
} from "~/domain/item/item-selling-price-review";

const baseBreakdown = {
  custoFichaTecnica: 10,
  wasteCost: 0,
  doughCostAmount: 2,
  packagingCostAmount: 3,
  dnaPercentage: 40,
  channel: {
    name: "Cardapio",
    taxPerc: 0,
    feeAmount: 0,
    isMarketplace: false,
    onlinePaymentTaxPerc: 0,
    targetMarginPerc: 10,
  },
  minimumPrice: {
    priceAmount: {
      breakEven: 25,
      withProfit: 30,
    },
    formulaExplanation: "",
    formulaExpression: "",
  },
} as any;

describe("calculateBreakEvenComposition", () => {
  it("decompoe o break-even em custo base mais DNA", () => {
    const result = calculateBreakEvenComposition({
      breakdown: baseBreakdown,
    });

    expect(result.baseCostAmount).toBe(15);
    expect(result.dnaAmount).toBe(10);
    expect(result.totalAmount).toBe(25);
    expect(result.breakEvenPrice).toBe(25);
  });
});

describe("calculateSellingPriceProfit", () => {
  it("mantem a margem alvo quando o preco atual coincide com o PV calculado", () => {
    const result = calculateSellingPriceProfit({
      priceAmount: 30,
      breakdown: baseBreakdown,
    });

    expect(result.baseCostAmount).toBe(15);
    expect(result.dnaAmount).toBe(12);
    expect(result.profitAmount).toBe(3);
    expect(result.profitPerc).toBe(10);
  });
});
