import {
  Category,
  MenuItem,
  MenuItemPriceVariation,
  Prisma,
} from "@prisma/client";
import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { Menu } from "lucide-react";
import { MenuItemPriceVariationPrismaEntity } from "./menu-item-price-variations.prisma.entity.server";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  categoryId: string;
  Category: Category;
}

export class MenuItemPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.MenuItemWhereInput) {
    const records = await this.client.menuItem.findMany({
      where,
      include: {
        priceVariations: true,
        Category: true,
      },
    });

    return records;
  }

  async findById(id: string) {
    return await this.client.menuItem.findUnique({ where: { id } });
  }

  async create(data: Prisma.MenuItemCreateInput) {
    data.priceVariations = {
      createMany: {
        data: MenuItemPriceVariationPrismaEntity.getInitialPriceVariations(),
      },
    };

    return await this.client.menuItem.create({ data });
  }

  async update(id: string, data: Prisma.MenuItemUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItem.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.menuItem.delete({ where: { id } });
  }
}

const menuItemPrismaEntity = new MenuItemPrismaEntity({
  client: prismaClient,
});

export { menuItemPrismaEntity };
