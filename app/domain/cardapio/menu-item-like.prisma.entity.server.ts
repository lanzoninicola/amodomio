import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

interface MenuItemLikeEntityFindAllProps {
  where?: Prisma.MenuItemLikeWhereInput;
}

export class MenuItemLikePrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(params: MenuItemLikeEntityFindAllProps) {
    return await this.client.menuItemLike.findMany(params);
  }

  async findById(id: string) {
    return await this.client.menuItemLike.findUnique({ where: { id } });
  }

  async findByItemId(itemId: string) {
    return await this.client.menuItemLike.findMany({
      where: { menuItemId: itemId },
    });
  }

  /**
   *  Create a new like and return the number of likes for the item
   */
  async create(data: Prisma.MenuItemLikeCreateInput) {
    await this.client.menuItemLike.create({ data });

    const itemId = data.MenuItem?.connect?.id;

    return this.countByMenuItemId(itemId);
  }

  async update(id: string, data: Prisma.MenuItemLikeUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItemLike.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.menuItemLike.delete({ where: { id } });
  }

  async countByMenuItemId(menuItemId: string | undefined) {
    if (!menuItemId) {
      return 0;
    }

    const result = await this.client.menuItemLike.groupBy({
      by: ["menuItemId"],
      _sum: {
        amount: true,
      },
      where: { menuItemId },
    });

    return result[0]?._sum.amount || 0;
  }
}

const menuItemLikePrismaEntity = new MenuItemLikePrismaEntity({
  client: prismaClient,
});

export { menuItemLikePrismaEntity };
