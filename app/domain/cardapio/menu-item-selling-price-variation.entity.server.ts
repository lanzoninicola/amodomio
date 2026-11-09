import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import { itemSellingChannelPrismaEntity } from "./menu-item-selling-channel.entity.server";
import { menuItemSellingPriceVariationAuditPrismaEntity } from "./menu-item-selling-price-variation-audit.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity";
import {
  invalidateCardapioIndexCache,
  invalidateSellingPriceHandlerCache,
} from "./cardapio-cache.server";

interface MenuItemSellingPriceVariationPrismaEntityConstructorProps
  extends PrismaEntityProps {
  menuItemCostVariationEntity: typeof menuItemCostVariationPrismaEntity;
  itemSellingChannelEntity: typeof itemSellingChannelPrismaEntity;
  menuItemSellingPriceUtilityEntity: typeof menuItemSellingPriceUtilityEntity;
  menuItemSellingPriceVariationAuditEntity: typeof menuItemSellingPriceVariationAuditPrismaEntity;
}

export interface MenuItemSellingPriceVariationBaseParams {
  menuItemId: string;
  menuItemSizeId: string | null;
  itemSellingChannelId: string | null;
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

  itemSellingChannelEntity;

  menuItemSellingPriceUtilityEntity;

  menuItemSellingPriceVariationAuditEntity;

  constructor({
    client,
    menuItemCostVariationEntity,
    itemSellingChannelEntity,
    menuItemSellingPriceUtilityEntity,
    menuItemSellingPriceVariationAuditEntity:
      menuItemSellingPriceVariationAuditPrismaEntity,
  }: MenuItemSellingPriceVariationPrismaEntityConstructorProps) {
    this.client = client;
    this.menuItemCostVariationEntity = menuItemCostVariationEntity;
    this.itemSellingChannelEntity = itemSellingChannelEntity;
    this.menuItemSellingPriceUtilityEntity = menuItemSellingPriceUtilityEntity;
    this.menuItemSellingPriceVariationAuditEntity =
      menuItemSellingPriceVariationAuditPrismaEntity;
  }

  async create(data: MenuItemSellingPriceVariationCreateParams) {
    const created = await this.client.menuItemSellingPriceVariation.create({
      data: {
        ...data,
        id: createUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await Promise.all([
      invalidateSellingPriceHandlerCache(),
      invalidateCardapioIndexCache(),
    ]);
    return created;
  }

  async upsert(id: string, data: MenuItemSellingPriceVariationUpsertParams) {
    const record = await this.client.menuItemSellingPriceVariation.findUnique({
      where: { id },
    });

    const now = new Date();

    if (record) {
      const updated = await this.client.menuItemSellingPriceVariation.update({
        where: { id },
        data: {
          ...data,
          updatedAt: now,
          previousPriceAmount: record.priceAmount,
        },
      });
      await Promise.all([
        invalidateSellingPriceHandlerCache(),
        invalidateCardapioIndexCache(),
      ]);
      return updated;
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

    const result = await Promise.all(upsertPromises);
    await Promise.all([
      invalidateSellingPriceHandlerCache(),
      invalidateCardapioIndexCache(),
    ]);
    return result;
  }
}

export const menuItemSellingPriceVariationPrismaEntity =
  new MenuItemSellingPriceVariationPrismaEntity({
    client: prismaClient,
    menuItemCostVariationEntity: menuItemCostVariationPrismaEntity,
    itemSellingChannelEntity: itemSellingChannelPrismaEntity,
    menuItemSellingPriceUtilityEntity: menuItemSellingPriceUtilityEntity,
    menuItemSellingPriceVariationAuditEntity:
      menuItemSellingPriceVariationAuditPrismaEntity,
  });
