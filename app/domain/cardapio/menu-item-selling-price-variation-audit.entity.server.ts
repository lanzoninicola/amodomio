import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";

interface MenuItemSellingPriceVariationAuditPrismaEntityConstructorProps
  extends PrismaEntityProps {}

export interface MenuItemSellingPriceVariationAuditBaseParams {
  menuItemId: string;
  menuItemSizeId: string;
  menuItemSellingChannelId: string;
  recipeCostAmount: number;
  packagingCostAmount: number;
  doughCostAmount: number;
  wasteCostAmount: number;
  dnaPerc: number;
  sellingPriceExpectedAmount: number;
  profitExpectedPerc: number;
  sellingPriceActualAmount: number;
  profitActualPerc: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedBy: string;
}

export interface MenuItemSellingPriceVariationAuditCreateParams
  extends MenuItemSellingPriceVariationAuditBaseParams {}

export interface MenuItemSellingPriceVariationAuditUpsertParams
  extends MenuItemSellingPriceVariationAuditBaseParams {
  id?: string;
}

class MenuItemSellingPriceVariationAuditPrismaEntity {
  client;

  constructor({
    client,
  }: MenuItemSellingPriceVariationAuditPrismaEntityConstructorProps) {
    this.client = client;
  }

  async create(data: MenuItemSellingPriceVariationAuditCreateParams) {
    return await this.client.menuItemSellingPriceVariationAudit.create({
      data: {
        ...data,
        id: createUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async upsert(
    id: string,
    data: MenuItemSellingPriceVariationAuditUpsertParams
  ) {
    const record =
      await this.client.menuItemSellingPriceVariationAudit.findUnique({
        where: { id },
      });

    const now = new Date();

    if (record) {
      return await this.client.menuItemSellingPriceVariationAudit.update({
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

  async findLast(
    menuItemId: string,
    menuItemSizeId: string,
    menuItemSellingChannelId: string
  ) {
    return await this.client.menuItemSellingPriceVariationAudit.findFirst({
      where: {
        menuItemId,
        menuItemSizeId,
        menuItemSellingChannelId,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const menuItemSellingPriceVariationAuditPrismaEntity =
  new MenuItemSellingPriceVariationAuditPrismaEntity({
    client: prismaClient,
  });
