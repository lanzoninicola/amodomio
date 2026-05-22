import { describe, expect, it } from "vitest";
import { analyzeComboPricing, buildComboSalesComparison, roundPriceUpToStep } from "./combo-pricing";

const validLines = [
  {
    unitPrice: 30,
    unitCost: 10,
    quantity: 2,
    isValidForSale: true,
    invalidReasons: [],
  },
  {
    unitPrice: 12,
    unitCost: 4,
    quantity: 1,
    isValidForSale: true,
    invalidReasons: [],
  },
];

describe("roundPriceUpToStep", () => {
  it("arredonda para cima em passos de 0.05", () => {
    expect(roundPriceUpToStep(33.333)).toBe(33.35);
    expect(roundPriceUpToStep(33.35)).toBe(33.35);
  });
});

describe("analyzeComboPricing", () => {
  it("calcula desconto percentual, DNA, lucro real e preco recomendado para cardapio proprio", () => {
    const result = analyzeComboPricing({
      lines: validLines,
      pricingMode: "PERCENTAGE_DISCOUNT",
      discountPercentage: 10,
      dnaPerc: 40,
      targetMarginPerc: 10,
    });

    expect(result.individualTotalPrice).toBe(72);
    expect(result.comboPrice).toBe(64.8);
    expect(result.equivalentDiscountAmount).toBe(7.2);
    expect(result.equivalentDiscountPercentage).toBe(10);
    expect(result.comboTotalCost).toBe(24);
    expect(result.dnaAmount).toBe(25.92);
    expect(result.operationalCost).toBe(49.92);
    expect(result.profitAmount).toBe(14.88);
    expect(result.profitPerc).toBe(22.96);
    expect(result.breakEvenPrice).toBe(40);
    expect(result.recommendedPrice).toBe(48);
    expect(result.status).toBe("HEALTHY");
    expect(result.isValidForSale).toBe(true);
  });

  it("calcula desconto equivalente mesmo com preco fixo", () => {
    const result = analyzeComboPricing({
      lines: validLines,
      pricingMode: "FIXED_PRICE",
      fixedPriceAmount: 60,
      dnaPerc: 40,
      targetMarginPerc: 10,
    });

    expect(result.comboPrice).toBe(60);
    expect(result.equivalentDiscountAmount).toBe(12);
    expect(result.equivalentDiscountPercentage).toBe(16.67);
  });

  it("marca abaixo do equilibrio antes de comparar margem alvo", () => {
    const result = analyzeComboPricing({
      lines: validLines,
      pricingMode: "FIXED_DISCOUNT",
      discountAmount: 40,
      dnaPerc: 40,
      targetMarginPerc: 10,
    });

    expect(result.comboPrice).toBe(32);
    expect(result.breakEvenPrice).toBe(40);
    expect(result.status).toBe("BELOW_BREAK_EVEN");
  });

  it("marca invalido quando uma linha nao tem ficha ativa", () => {
    const result = analyzeComboPricing({
      lines: [
        {
          unitPrice: 30,
          unitCost: null,
          quantity: 1,
          isValidForSale: false,
          invalidReasons: ["Item sem ficha tecnica ativa."],
        },
      ],
      pricingMode: "PERCENTAGE_DISCOUNT",
      discountPercentage: 10,
      dnaPerc: 40,
      targetMarginPerc: 10,
    });

    expect(result.isValidForSale).toBe(false);
    expect(result.invalidReasons).toContain("Item sem ficha tecnica ativa.");
  });
});

describe("buildComboSalesComparison", () => {
  it("compara venda avulsa e venda como combo usando o mesmo custo e DNA", () => {
    const result = buildComboSalesComparison({
      individualTotalPrice: 72,
      comboPrice: 64.8,
      comboTotalCost: 24,
      dnaPerc: 40,
    });

    expect(result.individualSale.profitAmount).toBe(19.2);
    expect(result.individualSale.profitPerc).toBe(26.67);
    expect(result.comboSale.profitAmount).toBe(14.88);
    expect(result.comboSale.profitPerc).toBe(22.96);
    expect(result.priceDeltaAmount).toBe(-7.2);
    expect(result.profitDeltaAmount).toBe(-4.32);
    expect(result.profitDeltaPerc).toBe(-22.5);
    expect(result.marginDeltaPerc).toBe(-3.71);
  });
});
