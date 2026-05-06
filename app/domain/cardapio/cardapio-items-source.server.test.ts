import { describe, expect, it } from "vitest";

import { buildPublicPriceVariations } from "./cardapio-items-source.server";

describe("buildPublicPriceVariations", () => {
  it("mapeia o cardapio publico pelas variacoes nativas do item", () => {
    const now = new Date("2026-05-05T12:00:00.000Z");

    const result = buildPublicPriceVariations({
      ItemSellingPriceVariation: [
        {
          id: "price-large",
          priceAmount: 79.9,
          priceExpectedAmount: 82.5,
          profitExpectedPerc: 28,
          discountPercentage: 0,
          previousPriceAmount: 75,
          createdAt: now,
          updatedAt: now,
          ItemVariation: {
            id: "item-variation-large",
            isReference: false,
            Variation: {
              id: "variation-large",
              code: "large",
              name: "Grande",
            },
          },
        },
        {
          id: "price-base",
          priceAmount: 49.9,
          priceExpectedAmount: 52.5,
          profitExpectedPerc: 22,
          discountPercentage: 0,
          previousPriceAmount: 47,
          createdAt: now,
          updatedAt: now,
          ItemVariation: {
            id: "item-variation-base",
            isReference: true,
            Variation: {
              id: "variation-base",
              code: "base",
              name: "Media",
            },
          },
        },
      ],
    } as any);

    expect(result).toEqual([
      {
        id: "price-base",
        itemVariationId: "item-variation-base",
        variationId: "variation-base",
        variationCode: "base",
        label: "Media",
        priceAmount: 49.9,
        priceExpectedAmount: 52.5,
        profitExpectedPerc: 22,
        discountPercentage: 0,
        previousPriceAmount: 47,
        showOnCardapio: true,
        showOnCardapioAt: now,
        sortOrderIndex: -1,
        isReference: true,
      },
      {
        id: "price-large",
        itemVariationId: "item-variation-large",
        variationId: "variation-large",
        variationCode: "large",
        label: "Grande",
        priceAmount: 79.9,
        priceExpectedAmount: 82.5,
        profitExpectedPerc: 28,
        discountPercentage: 0,
        previousPriceAmount: 75,
        showOnCardapio: true,
        showOnCardapioAt: now,
        sortOrderIndex: 1,
        isReference: false,
      },
    ]);
  });
});
