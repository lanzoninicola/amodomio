import { ComputedSellingPriceBreakdown } from "./menu-item-selling-price-utility.entity.server";
import { PizzaSizeKey } from "./menu-item-size.entity.server";

// para custos
export interface MenuItemWithCostVariations {
  menuItemId: string;
  name: string;
  ingredients: string;
  visible: boolean;
  active: boolean;
  costVariations: MenuItemCostVariationBySize[];
}

export interface MenuItemCostVariationBySize {
  menuItemCostVariationId: string | undefined;
  sizeId: string;
  sizeKey: string;
  sizeName: string;
  costAmount: number;
  proposedCostAmount: number;
  updatedBy: string | null | undefined;
  updatedAt: Date | undefined;
  previousCostAmount: number;
}

export interface SellPriceVariation {
  menuItemSellPriceVariationId?: string;
  sizeId: string;
  sizeKey: PizzaSizeKey | null;
  sizeName: string;
  channelId: string | null;
  channelKey: string | null;
  channelName: string;
  priceAmount: number;
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown | null;
  discountPercentage: number;
  updatedBy?: string;
  updatedAt?: Date;
  previousPriceAmount: number;
}

export interface MenuItemWithSellPriceVariations {
  menuItemId: string;
  name: string;
  ingredients?: string;
  visible: boolean;
  active: boolean;
  sellPriceVariations: SellPriceVariation[];
}

export interface MenuItemWithSellPriceVariationsAndCostVariations {
  menuItemId: string;
  name: string;
  ingredients?: string;
  visible: boolean;
  active: boolean;
  costVariations: MenuItemCostVariationBySize[];
  sellPriceVariations: SellPriceVariation[];
}
