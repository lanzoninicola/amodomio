import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

interface ItemShareEntityFindAllProps {
  where?: Prisma.ItemShareWhereInput;
}

export class ItemSharePrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(params: ItemShareEntityFindAllProps) {
    return await this.client.itemShare.findMany(params);
  }

  async create(data: Prisma.ItemShareCreateInput) {
    await this.client.itemShare.create({ data });
    const itemId = data.Item?.connect?.id;
    return this.countByItemId(itemId);
  }

  async countByItemId(itemId: string | undefined) {
    if (!itemId) return 0;
    return await this.client.itemShare.count({
      where: { itemId },
    });
  }
}

export const itemSharePrismaEntity = new ItemSharePrismaEntity({
  client: prismaClient as any,
});
