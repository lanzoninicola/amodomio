import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

export type MenuItemMarginImpactRow = {
  menuItemId: string;
  menuItemName: string;
  sizeId: string;
  sizeKey: string;
  sizeName: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  currentCostAmount: number;
  previousCostAmount: number;
  sellingPriceAmount: number;
  profitActualPerc: number;
  profitExpectedPerc: number;
  priceExpectedAmount: number;
  recommendedPriceAmount: number;
  priceGapAmount: number;
  marginGapPerc: number;
};

export async function listMenuItemMarginImpactRows(menuItemIds: string[]) {
  const uniqueIds = Array.from(
    new Set(menuItemIds.map((id) => String(id || "").trim()).filter(Boolean))
  );
  const rows: MenuItemMarginImpactRow[] = [];

  for (const menuItemId of uniqueIds) {
    const [item, itemWithCosts] = await Promise.all([
      menuItemSellingPriceHandler.loadOne(menuItemId),
      menuItemPrismaEntity.findOneWithCostVariations(menuItemId),
    ]);
    if (!item || !itemWithCosts) continue;

    const costBySizeId = new Map(
      (itemWithCosts.costVariations || []).map((variation) => [
        variation.sizeId,
        variation,
      ])
    );

    for (const variation of item.sellPriceVariations || []) {
      const currentCost = costBySizeId.get(variation.sizeId);
      const recommendedPriceAmount = Number(
        variation.computedSellingPriceBreakdown?.minimumPrice?.priceAmount
          ?.withProfit ?? 0
      );
      rows.push({
        menuItemId: item.menuItemId,
        menuItemName: item.name,
        sizeId: variation.sizeId,
        sizeKey: variation.sizeKey,
        sizeName: variation.sizeName,
        channelId: variation.channelId,
        channelKey: variation.channelKey,
        channelName: variation.channelName,
        currentCostAmount: Number(currentCost?.costAmount ?? 0),
        previousCostAmount: Number(currentCost?.previousCostAmount ?? 0),
        sellingPriceAmount: Number(variation.priceAmount ?? 0),
        profitActualPerc: Number(variation.profitActualPerc ?? 0),
        profitExpectedPerc: Number(variation.profitExpectedPerc ?? 0),
        priceExpectedAmount: Number(variation.priceExpectedAmount ?? 0),
        recommendedPriceAmount,
        priceGapAmount: Number(
          (recommendedPriceAmount - Number(variation.priceAmount ?? 0)).toFixed(4)
        ),
        marginGapPerc: Number(
          (
            Number(variation.profitExpectedPerc ?? 0) -
            Number(variation.profitActualPerc ?? 0)
          ).toFixed(4)
        ),
      });
    }
  }

  return rows;
}
