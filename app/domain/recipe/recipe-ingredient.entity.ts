import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { Prisma, RecipeType } from "@prisma/client";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export class RecipeIngredientEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.IngredientWhereInput) {
    if (!where) {
      return await this.client.ingredient.findMany();
    }

    return await this.client.ingredient.findMany({ where });
  }

  async findById(id: string) {
    return await this.client.ingredient.findUnique({ where: { id } });
  }

  async create(data: Prisma.IngredientCreateInput) {
    return await this.client.ingredient.create({ data });
  }

  async update(id: string, data: Prisma.IngredientUpdateInput) {
    return await this.client.ingredient.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.ingredient.delete({ where: { id } });
  }
}

export const recipeIngredientEntity = new RecipeIngredientEntity({
  client: prismaClient,
});
