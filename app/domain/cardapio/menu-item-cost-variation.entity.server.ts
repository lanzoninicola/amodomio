import { MenuItem, Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { PizzaSizeKey } from "./menu-item-size.entity.server";

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
}

export const menuItemCostVariationPrismaEntity =
  new MenuItemCostVariationPrismaEntity({
    client: prismaClient,
  });
