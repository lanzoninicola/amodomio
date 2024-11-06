import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type MenuItemPizzaSizeVariationSlug =
  | "pizza-small"
  | "pizza-medium"
  | "pizza-big"
  | "pizza-bigger";

class MenuItemCostPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async updateSizeVariationConfig(
    data: Prisma.MenuItemSizeVariationUpdateInput
  ) {}

  async findSizeConfig(size: MenuItemPizzaSizeVariationSlug) {
    return await this.client.menuItemSizeVariation.findFirst({
      where: {
        slug: size,
      },
    });
  }

  async findItemsCostBySize(size: MenuItemPizzaSizeVariationSlug) {
    // const sizeConfig = await this.findSizeConfig(size);

    return await this.client.menuItemCostVariation.findMany({
      where: {
        menuItemSizeVariations: {
          is: {
            slug: size,
          },
        },
      },
    });
  }
}

export const menuItemCostPrismaEntity = new MenuItemCostPrismaEntity({
  client: prismaClient,
});
