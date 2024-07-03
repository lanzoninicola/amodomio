import {
  Category,
  MenuItem,
  MenuItemPriceVariation,
  MenuItemTag,
  Prisma,
} from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MenuItemPriceVariationPrismaEntity } from "./menu-item-price-variations.prisma.entity.server";
import { menuItemTagPrismaEntity } from "./menu-item-tags.prisma.entity.server";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  categoryId: string;
  Category: Category;
  tags: MenuItemTag[];
}

interface MenuItemEntityFindAllProps {
  where?: Prisma.MenuItemWhereInput;
  option?: {
    sorted?: boolean;
    orderBy?: "asc" | "desc";
  };
}

export class MenuItemPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(params: MenuItemEntityFindAllProps) {
    const records = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
        priceVariations: true,
        Category: true,
        tags: true,
      },
    });

    if (records.length === 0) {
      return [];
    }

    if (!params?.option?.sorted) {
      return records;
    }

    return records.sort((a, b) => {
      if (params?.option && params?.option.orderBy === "asc") {
        return a.sortOrderIndex - b.sortOrderIndex;
      }

      return b.sortOrderIndex - a.sortOrderIndex;
    });
  }

  async findById(id: string) {
    return await this.client.menuItem.findUnique({
      where: { id },
      include: {
        priceVariations: true,
        Category: true,
        tags: true,
      },
    });
  }

  async create(data: Prisma.MenuItemCreateInput) {
    data.priceVariations = {
      createMany: {
        data: MenuItemPriceVariationPrismaEntity.getInitialPriceVariations(),
      },
    };

    const lastItem = await this.client.menuItem.findFirst({
      orderBy: { sortOrderIndex: "desc" },
    });

    const lastsortOrderIndex = lastItem?.sortOrderIndex || 0;

    const nextItem = {
      ...data,
      sortOrderIndex: lastsortOrderIndex + 1,
    };

    return await this.client.menuItem.create({ data: nextItem });
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

  async addTag(itemId: string, tagName: string) {
    return await menuItemTagPrismaEntity.create({
      name: tagName,
      createdAt: new Date().toISOString(),
      MenuItem: {
        connect: {
          id: itemId,
        },
      },
    });
  }

  async hasTag(itemId: string, tagName: string) {
    const tag = await this.client.menuItemTag.findFirst({
      where: {
        name: tagName,
        menuItemId: itemId,
      },
    });

    return !!tag;
  }

  async removeTag(itemId: string, tagName: string) {
    const tag = await this.client.menuItemTag.findFirst({
      where: {
        name: tagName,
        menuItemId: itemId,
      },
    });

    if (!tag) {
      return;
    }

    return await this.client.menuItemTag.delete({
      where: {
        id: tag.id,
      },
    });
  }
}

const menuItemPrismaEntity = new MenuItemPrismaEntity({
  client: prismaClient,
});

export { menuItemPrismaEntity };
