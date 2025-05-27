import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import { menuItemSellingChannelPrismaEntity } from "./menu-item-selling-channel.entity.server";
import { menuItemSellingPriceVariationAuditPrismaEntity } from "./menu-item-selling-price-variation-audit.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity";

interface MenuItemSellingPriceVariationPrismaEntityConstructorProps
  extends PrismaEntityProps {
  menuItemCostVariationEntity: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingChannelEntity: typeof menuItemSellingChannelPrismaEntity;
  menuItemSellingPriceUtilityEntity: typeof menuItemSellingPriceUtilityEntity;
  menuItemSellingPriceVariationAuditEntity: typeof menuItemSellingPriceVariationAuditPrismaEntity;
}

export interface MenuItemSellingPriceVariationBaseParams {
  menuItemId: string;
  menuItemSizeId: string | null;
  menuItemSellingChannelId: string | null;
  priceAmount: number;
  profitActualPerc: number;
  priceExpectedAmount: number;
  profitExpectedPerc: number;
  discountPercentage: number;
  showOnCardapio: boolean;
  showOnCardapioAt: Date | null;
  updatedBy?: string | null;
}

export interface MenuItemSellingPriceVariationCreateParams
  extends MenuItemSellingPriceVariationBaseParams {}

export interface MenuItemSellingPriceVariationUpsertParams
  extends MenuItemSellingPriceVariationBaseParams {
  id?: string;
}

class MenuItemSellingPriceVariationPrismaEntity {
  client;

  menuItemCostVariationEntity;

  menuItemSellingChannelEntity;

  menuItemSellingPriceUtilityEntity;

  menuItemSellingPriceVariationAuditEntity;

  constructor({
    client,
    menuItemCostVariationEntity,
    menuItemSellingChannelEntity,
    menuItemSellingPriceUtilityEntity,
    menuItemSellingPriceVariationAuditEntity:
      menuItemSellingPriceVariationAuditPrismaEntity,
  }: MenuItemSellingPriceVariationPrismaEntityConstructorProps) {
    this.client = client;
    this.menuItemCostVariationEntity = menuItemCostVariationEntity;
    this.menuItemSellingChannelEntity = menuItemSellingChannelEntity;
    this.menuItemSellingPriceUtilityEntity = menuItemSellingPriceUtilityEntity;
    this.menuItemSellingPriceVariationAuditEntity =
      menuItemSellingPriceVariationAuditPrismaEntity;
  }

  async create(data: MenuItemSellingPriceVariationCreateParams) {
    return await this.client.menuItemSellingPriceVariation.create({
      data: {
        ...data,
        id: createUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async upsert(id: string, data: MenuItemSellingPriceVariationUpsertParams) {
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
          previousPriceAmount: record.priceAmount,
        },
      });
    }

    return await this.create({
      ...data,
    });
  }

  async upsertMany(
    menuItemId: string,
    data: MenuItemSellingPriceVariationUpsertParams[]
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
    menuItemSellingPriceUtilityEntity: menuItemSellingPriceUtilityEntity,
    menuItemSellingPriceVariationAuditEntity:
      menuItemSellingPriceVariationAuditPrismaEntity,
  });
