import { describe, it, expect } from "vitest";
import { MenuItemPriceVariation } from "@prisma/client";
import MenuItemPriceVariationUtility from "./menu-item-price-variations-utility";

// Mock data for testing
const mockPriceVariations: MenuItemPriceVariation[] = [
  {
    label: "fatia",
    amount: 0,
    discountPercentage: 0,
    createdAt: new Date(),
    id: "",
    menuItemId: "",
    basePrice: 0,
    showOnCardapio: false,
    updatedAt: new Date(),
  },
  {
    label: "individual",
    amount: 0,
    discountPercentage: 0,
    createdAt: new Date(),
    id: "",
    menuItemId: "",
    basePrice: 0,
    showOnCardapio: false,
    updatedAt: new Date(),
  },
  {
    label: "media",
    amount: 0,
    discountPercentage: 0,
    createdAt: new Date(),
    id: "",
    menuItemId: "",
    basePrice: 0,
    showOnCardapio: false,
    updatedAt: new Date(),
  },
  {
    label: "familia",
    amount: 0,
    discountPercentage: 0,
    createdAt: new Date(),
    id: "",
    menuItemId: "",
    basePrice: 0,
    showOnCardapio: false,
    updatedAt: new Date(),
  },
];

describe("MenuItemPriceVariationUtility", () => {
  it("should calculate price variations correctly for different labels", () => {
    const basePrice = 99.9;
    const itemId = "test-item-id";

    const result = MenuItemPriceVariationUtility.calculatePriceVariations(
      basePrice,
      itemId
    );

    const resultFamilia = result.filter((pv) => pv.label === "familia");

    expect(resultFamilia[0].amount).toEqual(189.9);
  });

  it("should calculate price variations correctly for different labels", () => {
    const basePrice = 109.9;
    const itemId = "test-item-id";

    const result = MenuItemPriceVariationUtility.calculatePriceVariations(
      basePrice,
      itemId
    );

    const resultFamilia = result.filter((pv) => pv.label === "familia");

    expect(resultFamilia[0].amount).toEqual(209.9);
  });

  it("should handle unknown basePrice for familia label", () => {
    const basePrice = 50.0;
    const itemId = "test-item-id";

    const expectedPriceVariations = [
      { ...mockPriceVariations[0], menuItemId: itemId, amount: 0 },
      { ...mockPriceVariations[1], menuItemId: itemId, amount: 0 },
      { ...mockPriceVariations[2], menuItemId: itemId, amount: basePrice },
      { ...mockPriceVariations[3], menuItemId: itemId, amount: 0 },
    ];

    const result = MenuItemPriceVariationUtility.calculatePriceVariations(
      basePrice,
      itemId
    );

    const resultFamilia = result.filter((pv) => pv.label === "familia");

    expect(resultFamilia[0].amount).toEqual(0);
  });

  it("should use default itemId when not provided", () => {
    const basePrice = 99.9;

    const expectedPriceVariations = [
      { ...mockPriceVariations[0], menuItemId: "", amount: 0 },
      { ...mockPriceVariations[1], menuItemId: "", amount: 0 },
      { ...mockPriceVariations[2], menuItemId: "", amount: basePrice },
      { ...mockPriceVariations[3], menuItemId: "", amount: 189.9 },
    ];

    const result =
      MenuItemPriceVariationUtility.calculatePriceVariations(basePrice);

    const resultFamilia = result.filter((pv) => pv.label === "familia");

    expect(resultFamilia[0].menuItemId).toEqual("");
  });
});
