import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type MenuItemPizzaSizeVariationSlug =
  | "pizza-small"
  | "pizza-medium"
  | "pizza-big"
  | "pizza-bigger";

class MenuItemCostPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findSizeConfigBySlug(slug: MenuItemPizzaSizeVariationSlug) {
    return await this.client.menuItemSize.findFirst({
      where: {
        slug: slug,
      },
    });
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
    size: MenuItemPizzaSizeVariationSlug,
    refSize: MenuItemPizzaSizeVariationSlug = "pizza-medium"
  ) {
    const [refCosts, sizeCosts] = await Promise.all([
      this.client.menuItemCostVariation.findMany({
        where: { MenuItemSize: { is: { slug: refSize } } },
      }),
      this.client.menuItemCostVariation.findMany({
        where: { MenuItemSize: { is: { slug: size } } },
      }),
    ]);

    // Create a map of refCosts by ID for quick lookup of suggestedRecipeCost
    const refCostsMap = new Map(
      refCosts.map((ref) => [ref.menuItemId, ref.recipeCostAmount])
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
