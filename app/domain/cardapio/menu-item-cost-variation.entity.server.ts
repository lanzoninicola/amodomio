import { MenuItem, Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { PizzaSizeKey } from "./menu-item-size.entity.server";
import { MenuItemCostVariationUtility } from "./menu-item-cost-variation-utility.entity.server";

export interface MenuItemCostVariationBaseParams {
  menuItemId: string;
  costAmount: number;
  previousCostAmount: number;
  menuItemSizeId: string | null;
  updatedBy?: string | null;
}

export interface MenuItemCostVariationCreateInput
  extends MenuItemCostVariationBaseParams {}

export interface MenuItemCostVariationUpsertInput
  extends MenuItemCostVariationBaseParams {
  id?: string;
}

export class MenuItemCostVariationPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async create(data: MenuItemCostVariationCreateInput) {
    return await this.client.menuItemCostVariation.create({
      data: {
        ...data,
        id: createUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async upsert(id: string, data: MenuItemCostVariationUpsertInput) {
    const record = await this.client.menuItemCostVariation.findUnique({
      where: { id },
    });

    const now = new Date();

    if (record) {
      return await this.client.menuItemCostVariation.update({
        where: { id },
        data: {
          ...data,
          updatedAt: now,
          previousCostAmount: record.costAmount,
        },
      });
    }

    return await this.create({
      ...data,
    });
  }

  async upsertMany(
    menuItemId: string,
    data: MenuItemCostVariationUpsertInput[]
  ) {
    const now = new Date();

    const upsertPromises = data.map((item) =>
      this.client.menuItemCostVariation.upsert({
        where: { id: item.id || "" },
        create: {
          ...item,
          menuItemId,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          ...item,
          updatedAt: now,
        },
      })
    );

    return await Promise.all(upsertPromises);
  }

  /**
   * Updates all cost variations for a given menu item based on the reference cost amount.
   * This method calculates the recommended cost variations for each pizza size
   * and updates the cost variations in the database.
   *
   * @param menuItemId The ID of the menu item for which cost variations are to be updated.
   * @param refCostAmount The reference cost amount used to calculate the variations (the cost of the medium pizza).
   * @param updatedBy
   */
  async upsertMenuItemCostVariationsFromMedium(
    menuItemId: string,
    refCostAmount: number, // Reference cost amount to calculate variations
    updatedBy?: string | null
  ) {
    const recommendedCostVariations =
      MenuItemCostVariationUtility.calculateAllRecommendedCostVariations(
        refCostAmount
      );

    const sizeKeys: PizzaSizeKey[] = [
      "pizza-individual",
      "pizza-medium",
      "pizza-big",
      "pizza-bigger",
      "pizza-slice",
    ];

    const menuItemSizes = await this.client.menuItemSize.findMany({
      where: {
        key: { in: sizeKeys },
      },
    });

    // Fetch existing cost variations for performance
    const existingCosts = await this.client.menuItemCostVariation.findMany({
      where: {
        menuItemId,
      },
    });

    const existingCostMap = new Map<string, number>();
    for (const cost of existingCosts) {
      if (cost.menuItemSizeId) {
        existingCostMap.set(cost.menuItemSizeId, cost.costAmount);
      }
    }

    const updatePromises = menuItemSizes.map((size) => {
      const sizeKey = size.key as PizzaSizeKey;
      const costAmount = recommendedCostVariations[sizeKey];
      const previousCostAmount = existingCostMap.get(size.id) ?? 0;

      return this.client.menuItemCostVariation.upsert({
        where: {
          menuItemId_menuItemSizeId: {
            menuItemId,
            menuItemSizeId: size.id,
          },
        },
        create: {
          id: createUUID(),
          menuItemId,
          menuItemSizeId: size.id,
          costAmount,
          previousCostAmount: 0,
          updatedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          costAmount,
          previousCostAmount,
          updatedBy,
          updatedAt: new Date(),
        },
      });
    });

    await Promise.all(updatePromises);
  }

  async findAllCostBySizeKey(sizeKey: PizzaSizeKey = "pizza-medium") {
    return await this.client.menuItemCostVariation.findMany({
      where: {
        MenuItemSize: {
          is: { key: sizeKey },
        },
      },
    });
  }

  async findOneCostBySizeKey(menuItemId: string, sizeKey: PizzaSizeKey) {
    return await this.client.menuItemCostVariation.findFirst({
      where: {
        menuItemId,
        MenuItemSize: {
          is: { key: sizeKey },
        },
      },
    });
  }
}

export const menuItemCostVariationPrismaEntity =
  new MenuItemCostVariationPrismaEntity({
    client: prismaClient,
  });
