import { Prisma } from "@prisma/client";
import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export class MenuItemPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.MenuItemWhereInput) {
    return await this.client.menuItem.findMany({
      where,
      include: {
        prices: true,
        Category: true,
      },
    });
  }

  async findById(id: string) {
    return await this.client.menuItem.findUnique({ where: { id } });
  }

  async create(data: Prisma.MenuItemCreateInput) {
    return await this.client.menuItem.create({ data });
  }

  async update(id: string, data: Prisma.MenuItemUpdateInput) {
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
