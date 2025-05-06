import { MenuItemSellingChannel, MenuItemSize } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import {
  MenuItemCostVariationBySize,
  MenuItemWithCostVariations,
  MenuItemWithSellPriceVariations,
  SellPriceVariation,
  SellPriceVariationWithComputed,
} from "./menu-item.types";
import { CacheManager } from "../cache/cache-manager.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity.server";
import { menuItemSellingChannelPrismaEntity } from "./menu-item-selling-channel.entity.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { menuItemPrismaEntity } from "./menu-item.prisma.entity.server";

interface MenuItemSellingPriceHandlerProps extends PrismaEntityProps {
  menuItemPrismaEntity: typeof menuItemPrismaEntity;
  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;
  menuItemSize: typeof menuItemSizePrismaEntity;
  menuItemSellingChannel: typeof menuItemSellingChannelPrismaEntity;
}

export class MenuItemSellingPriceHandler {
  client;
  // Simple in-memory cache
  private cacheManager: CacheManager;

  menuItemPrismaEntity: typeof menuItemPrismaEntity;

  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;

  menuItemSellingChannel: typeof menuItemSellingChannelPrismaEntity;

  menuItemSize: typeof menuItemSizePrismaEntity;

  constructor({
    client,
    menuItemPrismaEntity,
    menuItemSellingPriceUtility,
    menuItemSize,
    menuItemSellingChannel,
  }: MenuItemSellingPriceHandlerProps) {
    this.client = client;
    this.cacheManager = new CacheManager();

    this.menuItemPrismaEntity = menuItemPrismaEntity;
    this.menuItemSellingPriceUtility = menuItemSellingPriceUtilityEntity;

    this.menuItemSize = menuItemSize;
    this.menuItemSellingChannel = menuItemSellingChannel;
  }

  async loadMany(params: {
    channelKey?: string;
    sizeKey?: string;
    menuItemId?: string;
  }): Promise<MenuItemWithSellPriceVariations[]> {
    const [
      allMenuItemsWithSellPrices,
      allMenuItemsWithCosts,
      sizes,
      channels,
      sellingPriceConfig,
    ] = await Promise.all([
      this.menuItemPrismaEntity.findManyWithSellPriceVariations(),
      this.menuItemPrismaEntity.findManyWithCostVariations(),
      this.menuItemSize.findAll(),
      this.menuItemSellingChannel.findAll(),
      this.menuItemSellingPriceUtility.getSellingPriceConfig(),
    ]);

    const filterSizes = (size: any) =>
      !params.sizeKey || size.key === params.sizeKey;

    const filterChannels = (channel: any) =>
      !params.channelKey || channel.key === params.channelKey;

    const costByItemAndSize: Record<string, MenuItemCostVariationBySize> = {};
    allMenuItemsWithCosts.forEach((item) => {
      item.costVariations.forEach((variation) => {
        costByItemAndSize[`${item.menuItemId}_${variation.sizeKey}`] =
          variation;
      });
    });

    const buildVariation = async (
      item: MenuItemWithSellPriceVariations,
      size: MenuItemSize,
      channel: MenuItemSellingChannel
    ): Promise<SellPriceVariationWithComputed> => {
      const variation = item.sellPriceVariations?.find(
        (spv: SellPriceVariation | SellPriceVariationWithComputed) =>
          spv.sizeId === size.id && spv.channelId === channel.id
      );

      // Calculate the selling price breakdown
      const computedSellingPriceBreakdown =
        await this.menuItemSellingPriceUtility.calculateSellingPriceByChannel(
          channel,
          costByItemAndSize[`${item.menuItemId}_${size.key}`]?.costAmount ?? 0,
          size,
          sellingPriceConfig
        );

      return {
        menuItemSellPriceVariationId: variation?.menuItemSellPriceVariationId,
        sizeId: size.id,
        sizeKey: size.key as PizzaSizeKey,
        sizeName: size.name,
        channelId: channel.id,
        channelKey: channel.key,
        channelName: channel.name,
        priceAmount: variation?.priceAmount ?? 0,
        computedSellingPriceBreakdown,
        discountPercentage: variation?.discountPercentage ?? 0,
        updatedBy: variation?.updatedBy,
        updatedAt: variation?.updatedAt,
        previousPriceAmount: variation?.previousPriceAmount ?? 0,
      };
    };

    const results = await Promise.all(
      allMenuItemsWithSellPrices.map(async (item) => {
        const filteredSizes = sizes.filter(filterSizes);
        const filteredChannels = channels.filter(filterChannels);

        const variations = await Promise.all(
          filteredSizes.flatMap((size) =>
            filteredChannels.map((channel) =>
              buildVariation(item, size, channel)
            )
          )
        );

        return {
          menuItemId: item.menuItemId,
          name: item.name,
          ingredients: item.ingredients,
          visible: item.visible,
          active: item.active,
          sellPriceVariations: variations,
        };
      })
    );

    return results;
  }
}

const menuItemSellingPriceHandler = new MenuItemSellingPriceHandler({
  client: prismaClient,
  menuItemPrismaEntity: menuItemPrismaEntity,
  menuItemSellingPriceUtility: menuItemSellingPriceUtilityEntity,
  menuItemSize: menuItemSizePrismaEntity,
  menuItemSellingChannel: menuItemSellingChannelPrismaEntity,
});

export { menuItemSellingPriceHandler };
