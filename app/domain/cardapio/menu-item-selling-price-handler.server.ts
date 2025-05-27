import {
  MenuItemGroup,
  MenuItemSellingChannel,
  MenuItemSize,
} from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import {
  MenuItemCostVariationBySize,
  MenuItemWithSellPriceVariations,
  SellPriceVariation,
  Warning,
} from "./menu-item.types";
import { CacheManager } from "../cache/cache-manager.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity";
import { menuItemSellingChannelPrismaEntity } from "./menu-item-selling-channel.entity.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { menuItemPrismaEntity } from "./menu-item.prisma.entity.server";

interface MenuItemSellingPriceHandlerProps extends PrismaEntityProps {
  menuItemPrismaEntity: typeof menuItemPrismaEntity;
  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;
  menuItemSize: typeof menuItemSizePrismaEntity;
  menuItemSellingChannel: typeof menuItemSellingChannelPrismaEntity;
}

type GroupedMenu = {
  group: MenuItemGroup;
  items: Omit<MenuItemWithSellPriceVariations, "group">[];
};

type LoadManyReturn<T extends "default" | "grouped" | undefined> =
  T extends "grouped" ? GroupedMenu[] : MenuItemWithSellPriceVariations[];

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

  async loadMany<T extends "default" | "grouped" | undefined = "default">(
    params: {
      channelKey?: string;
      sizeKey?: string;
      menuItemId?: string;
    },
    returnedOptions?: {
      format?: T;
      fn?: (data: MenuItemWithSellPriceVariations[]) => LoadManyReturn<T>;
    }
  ): Promise<LoadManyReturn<T>> {
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
    ): Promise<SellPriceVariation> => {
      const variation = item.sellPriceVariations?.find(
        (spv) => spv.sizeId === size.id && spv.channelId === channel.id
      );

      const computedSellingPriceBreakdown =
        await this.menuItemSellingPriceUtility.calculateSellingPriceByChannel(
          channel,
          costByItemAndSize[`${item.menuItemId}_${size.key}`]?.costAmount ?? 0,
          size,
          sellingPriceConfig
        );

      let itemSellPriceVariationWarnings: Warning[] = [];

      const warnings = this.handleSellPriceWarnings({
        itemName: item.name,
        sizeName: size.name,
        channelName: channel.name,
        computedPrice:
          computedSellingPriceBreakdown.minimumPrice.priceAmount.withProfit,
        actualPrice: variation?.priceAmount ?? 0,
      });

      if (warnings) {
        itemSellPriceVariationWarnings = [
          ...itemSellPriceVariationWarnings,
          ...warnings,
        ];
      }

      return {
        menuItemSellPriceVariationId: variation?.menuItemSellPriceVariationId,
        sizeId: size.id,
        sizeKey: size.key as PizzaSizeKey,
        sizeName: size.name,
        channelId: channel.id,
        channelKey: channel.key,
        channelName: channel.name,
        priceAmount: variation?.priceAmount ?? 0,
        profitActualPerc: variation?.profitActualPerc ?? 0,
        priceExpectedAmount: variation?.priceExpectedAmount ?? 0,
        profitExpectedPerc: variation?.profitExpectedPerc ?? 0,
        computedSellingPriceBreakdown,
        discountPercentage: variation?.discountPercentage ?? 0,
        updatedBy: variation?.updatedBy,
        updatedAt: variation?.updatedAt,
        previousPriceAmount: variation?.previousPriceAmount ?? 0,
        lastAuditRecord: variation?.lastAuditRecord,
        warnings: itemSellPriceVariationWarnings,
      };
    };

    const results = await Promise.all(
      allMenuItemsWithSellPrices.map(async (item) => {
        const filteredSizes = sizes.filter(filterSizes);
        const filteredChannels = channels.filter(filterChannels);

        const warnings: Warning[] = [];

        const variations = await Promise.all(
          filteredSizes.flatMap((size) =>
            filteredChannels.map((channel) =>
              buildVariation(item, size, channel)
            )
          )
        );

        variations.forEach((variation) => {
          if (variation.warnings) {
            warnings.push(...variation.warnings);
          }
        });

        return {
          menuItemId: item.menuItemId,
          group: item.group,
          name: item.name,
          ingredients: item.ingredients,
          visible: item.visible,
          active: item.active,
          sellPriceVariations: variations,
          warnings, // ← novo campo
        };
      })
    );

    if (returnedOptions?.fn) {
      return returnedOptions.fn(results);
    }

    return results as LoadManyReturn<T>;
  }

  private handleSellPriceWarnings({
    itemName,
    sizeName,
    channelName,
    computedPrice,
    actualPrice,
  }: {
    itemName: string;
    sizeName: string;
    channelName: string;
    computedPrice: number;
    actualPrice: number;
  }): Warning[] {
    const warnings: Warning[] = [];

    const base = `${itemName} (${sizeName} - ${channelName})`;

    // excluir os tamanhos "Fatia"
    if (sizeName === "Fatia") {
      return warnings;
    }

    if (actualPrice === 0) {
      warnings.push({
        type: "critical",
        code: "SELL_PRICE_ZERO",
        message: `O preço de venda de ${base} está zerado.`,
      });
    }

    if (actualPrice < computedPrice) {
      warnings.push({
        type: "alert",
        code: "SELL_PRICE_BELOW_RECOMMENDED",
        message: `O preço de venda de ${base} está abaixo do recomendado.`,
      });
    }

    return warnings;
  }

  static groupMenuItems(
    data: MenuItemWithSellPriceVariations[]
  ): GroupedMenu[] {
    const groupedMap = new Map<string, GroupedMenu>();

    for (const item of data) {
      const groupId = item.group.id;

      if (!groupedMap.has(groupId)) {
        groupedMap.set(groupId, {
          group: item.group,
          items: [],
        });
      }

      const itemWithoutGroup: Omit<MenuItemWithSellPriceVariations, "group"> = {
        ...item,
      };
      delete (itemWithoutGroup as any).group;

      groupedMap.get(groupId)!.items.push(itemWithoutGroup);
    }

    return Array.from(groupedMap.values());
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
