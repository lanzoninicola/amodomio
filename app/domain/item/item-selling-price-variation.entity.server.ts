import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

type UpsertItemSellingPriceInput = {
  itemId: string;
  itemVariationId: string;
  itemSellingChannelId: string;
  priceAmount: number;
  priceExpectedAmount?: number;
  profitActualPerc?: number;
  profitExpectedPerc?: number;
  discountPercentage?: number;
  published?: boolean;
  updatedBy?: string | null;
};

class ItemSellingPriceVariationEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  private get model() {
    return (this.client as any).itemSellingPriceVariation;
  }

  async isAvailable() {
    return typeof this.model?.findMany === "function";
  }

  async findManyByItemId(itemId: string) {
    if (!(await this.isAvailable()) || !itemId) return [];

    return await this.model.findMany({
      where: { itemId },
      include: {
        ItemVariation: {
          include: {
            Variation: true,
          },
        },
        ItemSellingChannel: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async upsert(input: UpsertItemSellingPriceInput) {
    if (!(await this.isAvailable())) {
      throw new Error("ItemSellingPriceVariation ainda nao disponivel no Prisma Client");
    }

    const priceAmount = Number(input.priceAmount || 0);

    const existing = await this.model.findFirst({
      where: {
        itemVariationId: input.itemVariationId,
        itemSellingChannelId: input.itemSellingChannelId,
      },
    });

    if (existing) {
      return await this.model.update({
        where: { id: existing.id },
        data: {
          itemId: input.itemId,
          priceAmount,
          previousPriceAmount: Number(existing.priceAmount || 0),
          priceExpectedAmount: Number(input.priceExpectedAmount || 0),
          profitActualPerc: Number(input.profitActualPerc || 0),
          profitExpectedPerc: Number(input.profitExpectedPerc || 0),
          discountPercentage: Number(input.discountPercentage || 0),
          published: Boolean(input.published),
          publishedAt: input.published ? new Date() : null,
          updatedBy: input.updatedBy || null,
        },
      });
    }

    return await this.model.create({
      data: {
        itemId: input.itemId,
        itemVariationId: input.itemVariationId,
        itemSellingChannelId: input.itemSellingChannelId,
        priceAmount,
        previousPriceAmount: 0,
        priceExpectedAmount: Number(input.priceExpectedAmount || 0),
        profitActualPerc: Number(input.profitActualPerc || 0),
        profitExpectedPerc: Number(input.profitExpectedPerc || 0),
        discountPercentage: Number(input.discountPercentage || 0),
        published: Boolean(input.published),
        publishedAt: input.published ? new Date() : null,
        updatedBy: input.updatedBy || null,
      },
    });
  }
}

export const itemSellingPriceVariationEntity = new ItemSellingPriceVariationEntity({
  client: prismaClient,
});
