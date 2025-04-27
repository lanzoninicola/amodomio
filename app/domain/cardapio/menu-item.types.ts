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
  sizeName: string;
  costAmount: number;
  updatedBy: string | null | undefined;
  updatedAt: Date | undefined;
  previousCostAmount: number;
}

// para preços de venda
export interface MenuItemWithSellPriceVariations {
  id: string;
  name: string;
  ingredients: string;
  sellPriceVariations: MenuItemSellPriceVariationBySizeAndChannel[];
}

interface MenuItemSellPriceVariationBySizeAndChannel {
  sizeId: string;
  sizeName: string;
  channelId: string;
  channelName: string;
  priceAmount: number;
  discountPercentage: number;
}
