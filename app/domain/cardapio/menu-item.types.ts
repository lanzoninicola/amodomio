// para custos
export interface MenuItemWithCostVariations {
  menuItemId: string;
  name: string;
  ingredients: string;
  costVariations: MenuItemCostVariationBySize[];
}

interface MenuItemCostVariationBySize {
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

// para preços de venda
export interface MenuItemWithSellPriceVariations {
  menuItemId: string;
  name: string;
  ingredients: string;
  sellPriceVariations: MenuItemSellPriceVariationBySizeAndChannel[];
}

interface MenuItemSellPriceVariationBySizeAndChannel {
  menuItemSellPriceVariationId: string | undefined;
  sizeId: string;
  sizeKey: string;
  sizeName: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  priceAmount: number;
  proposedPriceAmount: number;
  discountPercentage: number;
  updatedBy: string | null | undefined;
  updatedAt: Date | undefined;
  previousPriceAmount: number;
}
