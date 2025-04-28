import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

/**
 * DO NOT USE
 *
 * // deprecated
 * // This entity is deprecated and will be removed in the future.
 * @deprecated
 */
class MenuItemCostPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async updateSizeConfig(
    id: string,
    {
      costScalingFactor,
      costBase,
    }: {
      costScalingFactor: number;
      costBase: number;
    }
  ) {
    const sizeConfig = await this.client.menuItemSize.findFirst({
      where: {
        id,
      },
    });

    if (!sizeConfig) {
      return;
    }

    const nextSizeConfig = {
      ...sizeConfig,
      costScalingFactor,
      costBase,
    } as Prisma.MenuItemSizeUpdateInput;

    console.log({ nextSizeConfig });

    return await this.client.menuItemSize.update({
      where: {
        id,
      },
      data: nextSizeConfig,
    });
  }

  async findItemsCostBySize(
    sizeId: string,
    refSizeKey: string = "pizza-medium"
  ) {
    const [refCosts, sizeCosts] = await Promise.all([
      this.client.menuItemCostVariation.findMany({
        where: { MenuItemSize: { is: { id: sizeId } } },
      }),
      this.client.menuItemCostVariation.findMany({
        where: { MenuItemSize: { is: { key: refSizeKey } } },
      }),
    ]);

    // Create a map of refCosts by ID for quick lookup of suggestedRecipeCost
    const refCostsMap = new Map(
      refCosts.map((ref) => [ref.menuItemId, ref.costAmount])
    );

    // Map over sizeCosts, using refCosts only for suggestedRecipeCost
    const result = sizeCosts.map((sizeItem) => {
      return {
        ...sizeItem, // Include all properties from sizeCosts
        suggestedRecipeCost: refCostsMap.get(sizeItem.menuItemId) ?? null, // Use refCosts for suggestedRecipeCost
      };
    });

    return result;
  }

  async updateMenuItemCost(
    id: string,
    data: Prisma.MenuItemCostVariationUpdateInput
  ) {
    return await this.client.menuItemCostVariation.update({
      where: {
        id,
      },
      data,
    });
  }

  async upsertMenuItemCost(
    sizeId: string,
    menuItemId: string,
    data: Prisma.MenuItemCostVariationCreateInput
  ) {
    const record = await this.client.menuItemCostVariation.findFirst({
      where: {
        menuItemId: menuItemId,
        menuItemSizeId: sizeId,
      },
    });

    if (record) {
      return await this.client.menuItemCostVariation.update({
        where: {
          id: record.id,
        },
        data,
      });
    }

    return await this.client.menuItemCostVariation.create({
      data,
    });
  }
}

export const menuItemCostPrismaEntity = new MenuItemCostPrismaEntity({
  client: prismaClient,
});
