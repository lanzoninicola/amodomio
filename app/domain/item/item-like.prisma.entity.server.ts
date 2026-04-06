import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

interface ItemLikeEntityFindAllProps {
  where?: Prisma.ItemLikeWhereInput;
}

export class ItemLikePrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(params: ItemLikeEntityFindAllProps) {
    return await this.client.itemLike.findMany(params);
  }

  async create(data: Prisma.ItemLikeCreateInput) {
    await this.client.itemLike.create({ data });
    const itemId = data.Item?.connect?.id;
    return this.countByItemId(itemId);
  }

  async countByItemId(itemId: string | undefined) {
    if (!itemId) return 0;
    const result = await this.client.itemLike.groupBy({
      by: ["itemId"],
      _sum: { amount: true },
      where: {
        itemId,
        amount: { gt: 0, lte: 1 },
        deletedAt: null,
      },
    });
    return result[0]?._sum.amount || 0;
  }
}

export const itemLikePrismaEntity = new ItemLikePrismaEntity({
  client: prismaClient as any,
});
