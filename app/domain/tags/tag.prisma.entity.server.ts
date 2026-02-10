import { Prisma, Tag } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

class TagPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.TagWhereInput): Promise<Tag[] | null> {
    return await this.client.tag.findMany({
      where,
    });
  }

  async findById(id: string) {
    return await this.client.tag.findUnique({ where: { id } });
  }

  async updateOrCreate(data: Prisma.TagWhereInput) {
    const tagName = data?.name;

    const record = await this.client.tag.findFirst({
      where: {
        name: tagName,
      },
    });

    if (record) {
      const nextData = {
        ...record,
        ...data,
      } as Prisma.TagUpdateInput;

      return await this.update(record.id, nextData);
    }

    return await this.create(data as Prisma.TagCreateInput);
  }

  async updateOrCreateMany(data: Prisma.TagWhereInput[]) {
    const upsertPromise = data.map((item) => this.updateOrCreate(item));

    return Promise.all(upsertPromise);
  }

  async create(data: Prisma.TagCreateInput) {
    const created = await this.client.tag.create({ data });
    await invalidateCardapioIndexCache();
    return created;
  }

  async update(id: string, data: Prisma.TagUpdateInput) {
    const updated = await this.client.tag.update({ where: { id }, data });
    await invalidateCardapioIndexCache();
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.client.tag.delete({ where: { id } });
    await invalidateCardapioIndexCache();
    return deleted;
  }

  async findAllContexts(): Promise<string[]> {
    return await this.client.$queryRaw`SELECT DISTINCT context FROM Tags`;
  }
}

const tagPrismaEntity = new TagPrismaEntity({
  client: prismaClient,
});

export { tagPrismaEntity };
