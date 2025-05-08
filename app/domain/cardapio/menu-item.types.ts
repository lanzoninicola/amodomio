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
  warnings?: Warning[];
}

export interface MenuItemCostVariationBySize {
  menuItemCostVariationId: string | undefined;
  sizeId: string;
  sizeKey: string;
  sizeName: string;
  costAmount: number;
  updatedBy: string | null | undefined;
  updatedAt: Date | undefined;
  previousCostAmount: number;
  recommendedCostAmount?: number;
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
  discountPercentage: number;
  updatedBy?: string;
  updatedAt?: Date;
  previousPriceAmount: number;
  computedSellingPriceBreakdown?: ComputedSellingPriceBreakdown;
  warnings?: Warning[];
}

export interface MenuItemWithSellPriceVariations {
  menuItemId: string;
  name: string;
  ingredients?: string;
  visible: boolean;
  active: boolean;
  sellPriceVariations: SellPriceVariation[];
  warnings?: Warning[];
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

type WarningType = "info" | "alert" | "critical";

export interface Warning {
  type: WarningType;
  code: string;
  message: string;
}
