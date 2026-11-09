import { describe, expect, it } from "vitest";
import { computeNativeItemSellingPriceBreakdown } from "~/domain/item/item-selling-price-calculation.server";

describe("computeNativeItemSellingPriceBreakdown", () => {
  it("calcula o preco usando CMV mais embalagem sem reaplicar desperdicio no custo", () => {
    const breakdown = computeNativeItemSellingPriceBreakdown({
      channel: {
        name: "Cardapio",
        taxPerc: 0,
        feeAmount: 0,
        isMarketplace: false,
        onlinePaymentTaxPerc: 0,
        targetMarginPerc: 10,
      } as any,
      itemCostAmount: 10,
      sellingPriceConfig: {
        dnaPercentage: 40,
        wastePercentage: 7,
      },
      size: {
        pizzaDoughCostAmount: 2,
        packagingCostAmount: 3,
      } as any,
    });

    expect(breakdown.custoFichaTecnica).toBe(10);
    expect(breakdown.wasteCost).toBe(0);
    expect(breakdown.doughCostAmount).toBe(0);
    expect(breakdown.packagingCostAmount).toBe(0);
    expect(breakdown.minimumPrice.priceAmount.breakEven).toBe(16.7);
    expect(breakdown.minimumPrice.priceAmount.withProfit).toBe(20);
  });
});
