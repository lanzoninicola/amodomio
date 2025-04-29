import { MenuItem, Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { PizzaSizeKey } from "./menu-item-size.entity.server";

export interface MenuItemCostVariationBaseInput {
  menuItemId: string;
  costAmount: number;
  previousCostAmount: number;
  menuItemSizeId: string | null;
  updatedBy?: string | null;
}

export interface MenuItemCostVariationCreateInput
  extends MenuItemCostVariationBaseInput {}

export interface MenuItemCostVariationUpsertInput
  extends MenuItemCostVariationBaseInput {
  id?: string;
}

export class MenuItemCostVariationPrismaEntity {
  pizzaSizeKeyRef: PizzaSizeKey = "pizza-medium";
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

  /**
   * Find all cost variations for the reference size key.
   *
   * Other costs are calculated based on this reference size key.
   * At this moment, the reference size key is "pizza-medium".
   *
   * @returns
   */
  async findAllReferenceCost() {
    return await this.findAllCostBySizeKey(this.pizzaSizeKeyRef);
  }

  /**
   * The logic for calculating the cost variation for each pizza topping
   * based on the size key.
   *
   * @param size
   * @param refCostAmount
   * @returns
   */
  static calculateOneProposedCostVariation(
    size: PizzaSizeKey,
    refCostAmount: number
  ): number {
    switch (size) {
      case "pizza-small":
        return refCostAmount * 0.5;
      case "pizza-medium":
        return refCostAmount;
      case "pizza-big":
        return refCostAmount * 1.25;
      case "pizza-bigger":
        return refCostAmount * 2;
      case "pizza-slice":
        return refCostAmount * 0.25;
      default:
        throw new Error("Invalid pizza size");
    }
  }
}

export const menuItemCostVariationPrismaEntity =
  new MenuItemCostVariationPrismaEntity({
    client: prismaClient,
  });
