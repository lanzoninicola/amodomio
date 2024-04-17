import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { Prisma } from "@prisma/client";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export class RecipeEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.RecipeWhereInput) {
    if (!where) {
      return await this.client.recipe.findMany();
    }

    return await this.client.recipe.findMany({ where });
  }

  async findById(id: string) {
    return await this.client.recipe.findUnique({ where: { id } });
  }

  async create(data: Prisma.ProductCreateInput) {
    return await this.client.recipe.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return await this.client.recipe.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.recipe.delete({ where: { id } });
  }
}

export const recipeEntity = new RecipeEntity({
  client: prismaClient,
});
