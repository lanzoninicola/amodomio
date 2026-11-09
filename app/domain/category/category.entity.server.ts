import prismaClient from "~/lib/prisma/client.server";
import type { Prisma } from "@prisma/client";
import type { CategoryType } from "./category.model.server";
import type { PrismaEntityProps } from "~/lib/prisma/types.server";

export interface CategoryTypeSelectElement {
  value: CategoryType;
  label: string;
}

export class CategoryPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  getTypes(): CategoryTypeSelectElement[] {
    return [
      { value: "item", label: "Item" },
      { value: "menu", label: "Cardapío" },
    ];
  }

  async findAll(where?: Prisma.CategoryWhereInput) {
    if (!where) return this.client.category.findMany();
    return this.client.category.findMany({ where });
  }

  async findById(id: string) {
    return this.client.category.findUnique({ where: { id } });
  }

  async create(data: Prisma.CategoryCreateInput) {
    return this.client.category.create({
      data: {
        createdAt: new Date(),
        ...data,
      },
    });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return this.client.category.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.client.category.delete({ where: { id } });
  }

  // Prisma schema no longer has a `default` field on categories.
  // Fallback behavior: use the first category of the requested type by sort order.
  async getDefaultCategory(type: string) {
    return this.client.category.findFirst({
      where: { type },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async sortDown(id: string) {
    const current = await this.findById(id);

    if (!current) {
      throw new Error("Não foi possível encontrar a categoria");
    }

    const next = await this.client.category.findFirst({
      where: {
        type: current.type,
        sortOrder: { gt: current.sortOrder },
      },
      orderBy: { sortOrder: "asc" },
    });

    if (!next) return current;

    await this.client.$transaction([
      this.client.category.update({
        where: { id: current.id },
        data: { sortOrder: next.sortOrder },
      }),
      this.client.category.update({
        where: { id: next.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return this.findById(id);
  }

  async sortUp(id: string) {
    const current = await this.findById(id);

    if (!current) {
      throw new Error("Categoria não encontrada");
    }

    const previous = await this.client.category.findFirst({
      where: {
        type: current.type,
        sortOrder: {
          lt: current.sortOrder,
          gte: 1000,
        },
      },
      orderBy: { sortOrder: "desc" },
    });

    if (!previous) return current;

    await this.client.$transaction([
      this.client.category.update({
        where: { id: current.id },
        data: { sortOrder: previous.sortOrder },
      }),
      this.client.category.update({
        where: { id: previous.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return this.findById(id);
  }
}

export const categoryPrismaEntity = new CategoryPrismaEntity({
  client: prismaClient,
});
