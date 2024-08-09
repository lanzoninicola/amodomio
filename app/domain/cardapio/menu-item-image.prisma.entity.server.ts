import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

class MenuItemImagePrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findByMenuItemId(menuItemId: string) {
    return await this.client.menuItemImage.findMany({
      where: {
        MenuItem: {
          some: { id: menuItemId },
        },
      },
    });
  }

  async upsert(id: string, data: Prisma.MenuItemImageCreateInput) {
    return await this.client.menuItemImage.upsert({
      where: { id },
      create: data,
      update: data,
    });
  }
}

export const menuItemImagePrismaEntity = new MenuItemImagePrismaEntity({
  client: prismaClient,
});
