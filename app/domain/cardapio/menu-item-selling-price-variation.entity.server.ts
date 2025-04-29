import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import { menuItemSellingChannelPrismaEntity } from "./menu-item-selling-channel.entity.server";

interface MenuItemSellingPriceVariationPrismaEntityConstructorProps
  extends PrismaEntityProps {
  menuItemCostVariationEntity: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingChannelEntity: typeof menuItemSellingChannelPrismaEntity;
}

export interface MenuItemSellingPriceVariationBaseInput {
  menuItemId: string;
  menuItemSizeId: string | null;
  menuItemSellinChannelId: string | null;
  priceAmount: number;
  discountPercentage: number;
  showOnCardapio: boolean;
  showOnCardapioAt: Date | null;
  updatedBy?: string | null;
}

export interface MenuItemSellingPriceVariationCreateInput
  extends MenuItemSellingPriceVariationBaseInput {}

export interface MenuItemSellingPriceVariationUpsertInput
  extends MenuItemSellingPriceVariationBaseInput {
  id?: string;
}

class MenuItemSellingPriceVariationPrismaEntity {
  client;

  menuItemCostVariationEntity;

  menuItemSellingChannelEntity;

  constructor({
    client,
    menuItemCostVariationEntity,
    menuItemSellingChannelEntity,
  }: MenuItemSellingPriceVariationPrismaEntityConstructorProps) {
    this.client = client;
    this.menuItemCostVariationEntity = menuItemCostVariationEntity;
    this.menuItemSellingChannelEntity = menuItemSellingChannelEntity;
  }

  async create(data: MenuItemSellingPriceVariationCreateInput) {
    return await this.client.menuItemSellingPriceVariation.create({
      data: {
        ...data,
        id: createUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async upsert(id: string, data: MenuItemSellingPriceVariationUpsertInput) {
    const record = await this.client.menuItemSellingPriceVariation.findUnique({
      where: { id },
    });

    const now = new Date();

    if (record) {
      return await this.client.menuItemSellingPriceVariation.update({
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
    data: MenuItemSellingPriceVariationUpsertInput[]
  ) {
    const now = new Date();

    const upsertPromises = data.map((item) =>
      this.client.menuItemSellingPriceVariation.upsert({
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
}

export const menuItemSellingPriceVariationPrismaEntity =
  new MenuItemSellingPriceVariationPrismaEntity({
    client: prismaClient,
    menuItemCostVariationEntity: menuItemCostVariationPrismaEntity,
    menuItemSellingChannelEntity: menuItemSellingChannelPrismaEntity,
  });
