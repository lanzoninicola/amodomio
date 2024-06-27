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

  async findAll({
    where,
    option,
  }: {
    where?: Prisma.MenuItemWhereInput;
    option?: { sorted?: boolean; orderBy?: "asc" | "desc" };
  }) {
    const records = await this.client.menuItem.findMany({
      where,
      include: {
        priceVariations: true,
        Category: true,
      },
    });

    if (!option?.sorted) {
      return records;
    }

    return records.sort((a, b) => {
      if (option.orderBy === "asc") {
        return a.menuIndex - b.menuIndex;
      }

      return b.menuIndex - a.menuIndex;
    });
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

    const lastItem = await this.client.menuItem.findFirst({
      orderBy: { menuIndex: "desc" },
    });

    const lastMenuIndex = lastItem?.menuIndex || 0;

    const nextItem = {
      ...data,
      menuIndex: lastMenuIndex + 1,
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

  async move(
    itemDraggingId: string,
    itemOveredId: string,
    overedPoint: "top" | "bottom" | "none"
  ) {
    const itemDragging = await this.findById(itemDraggingId);
    const itemOvered = await this.findById(itemOveredId);

    console.log({
      itemDragging,
      itemOvered,
      overedPoint,
    });

    if (!itemDragging || !itemOvered) {
      throw new Error("Item not found");
    }

    const currentPositionItemDragging = itemDragging.menuIndex;
    const currentPositionItemOvered = itemOvered.menuIndex;

    if (overedPoint === "none") return;

    try {
      // change the position for the item dragging
      await this.client.menuItem.update({
        where: { id: itemDraggingId },
        data: { menuIndex: currentPositionItemOvered },
      });

      // change the position for the item overed
      if (overedPoint === "top") {
        await this.client.menuItem.update({
          where: { id: itemOveredId },
          data: { menuIndex: currentPositionItemDragging - 1 },
        });
      }

      if (overedPoint === "bottom") {
        await this.client.menuItem.update({
          where: { id: itemDraggingId },
          data: { menuIndex: currentPositionItemOvered + 1 },
        });
      }
    } catch (error) {
      // if error, we need to rollback the changes
      await this.client.menuItem.update({
        where: { id: itemDraggingId },
        data: { menuIndex: currentPositionItemDragging },
      });

      await this.client.menuItem.update({
        where: { id: itemOveredId },
        data: { menuIndex: currentPositionItemOvered },
      });

      throw new Error("Failed to move item");
    }
  }
}

const menuItemPrismaEntity = new MenuItemPrismaEntity({
  client: prismaClient,
});

export { menuItemPrismaEntity };
