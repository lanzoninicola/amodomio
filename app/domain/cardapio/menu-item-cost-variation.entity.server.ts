import { MenuItem, Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";

export type PizzaSizeKey =
  | "pizza-small"
  | "pizza-medium"
  | "pizza-big"
  | "pizza-bigger"
  | "pizza-slice";

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
    console.log("upsert", { id, data });

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

  async findAllCostBySizeKey(sizeKey: PizzaSizeKey = "pizza-medium") {
    return await this.client.menuItemCostVariation.findMany({
      where: {
        MenuItemSize: {
          is: { key: sizeKey },
        },
      },
    });
  }

  async findAllReferenceCost() {
    return await this.findAllCostBySizeKey(this.pizzaSizeKeyRef);
  }

  static calculateItemProposedCostVariation(
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
