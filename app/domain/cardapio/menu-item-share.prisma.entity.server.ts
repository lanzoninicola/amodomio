import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

interface MenuItemShareEntityFindAllProps {
  where?: Prisma.MenuItemShareWhereInput;
}

export class MenuItemSharePrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(params: MenuItemShareEntityFindAllProps) {
    return await this.client.menuItemShare.findMany(params);
  }

  async findById(id: string) {
    return await this.client.menuItemShare.findUnique({ where: { id } });
  }

  async findByItemId(itemId: string) {
    return await this.client.menuItemShare.findMany({
      where: { menuItemId: itemId },
    });
  }

  /**
   *  Create a new Share and return the number of Shares for the item
   */
  async create(data: Prisma.MenuItemShareCreateInput) {
    await this.client.menuItemShare.create({ data });

    const itemId = data.MenuItem?.connect?.id;

    return this.countByMenuItemId(itemId);
  }

  async update(id: string, data: Prisma.MenuItemShareUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItemShare.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.menuItemShare.delete({ where: { id } });
  }

  async countByMenuItemId(menuItemId: string | undefined) {
    if (!menuItemId) {
      return 0;
    }

    return await this.client.menuItemShare.count({
      where: { menuItemId },
    });
  }
}

const menuItemSharePrismaEntity = new MenuItemSharePrismaEntity({
  client: prismaClient,
});

export { menuItemSharePrismaEntity };
