import { badRequest, serverError } from "~/utils/http-response.server";
import type { Category, CategoryType } from "./category.model.server";
import { CategoryModel } from "./category.model.server";
import { BaseEntity } from "../base.entity";
import prismaClient from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export interface CategoryTypeSelectElement {
  value: CategoryType;
  label: string;
}

class CategoryEntity extends BaseEntity<Category> {
  override async create(category: Category): Promise<Category> {
    this.validate(category);

    // const latest = await this.getLatest();

    // if (latest) {
    //   category.sortOrder = (latest?.sortOrder || 0) + 1000;
    // } else {
    //   category.sortOrder = 1000;
    // }

    return await super.save(category);
  }

  async sortDown(id: string): Promise<Category> {
    const current = await this.findById(id);

    if (!current) {
      badRequest("Não foi possível encontrar a categoria");
    }

    const nextValues = await CategoryModel.whereCompound([
      {
        field: "type",
        op: "==",
        value: current!.type,
      },

      {
        field: "visible",
        op: "==",
        value: true,
      },
      {
        field: "sortOrder",
        op: ">",
        value: current!.sortOrder,
      },
    ]);

    if (nextValues.length === 0) {
      return current!;
    }

    const next = nextValues[0];
    const nextValueSortOrder = next.sortOrder;

    next.sortOrder = current!.sortOrder;
    current!.sortOrder = nextValueSortOrder;

    await CategoryModel.update(current!.id as string, {
      sortOrder: current!.sortOrder,
    });

    await CategoryModel.update(next!.id as string, {
      sortOrder: next.sortOrder,
    });

    return current!;
  }

  async sortUp(id: string): Promise<Category> {
    const current = await this.findById(id);

    if (!current) {
      badRequest("Categoria não encontrada");
    }

    if (current?.sortOrder === 1000) {
      return current;
    }

    const previous = await CategoryModel.whereCompound([
      {
        field: "sortOrder",
        op: "<",
        value: current!.sortOrder,
      },
      {
        field: "type",
        op: "==",
        value: current!.type,
      },

      {
        field: "visible",
        op: "==",
        value: true,
      },

      {
        field: "sortOrder",
        op: ">=",
        value: 1000,
      },
    ]);

    if (previous.length === 0) {
      return current!;
    }

    const previousValue = previous[0];

    const previousSortOrder = previousValue.sortOrder;

    previousValue.sortOrder = current!.sortOrder;
    current!.sortOrder = previousSortOrder;

    await CategoryModel.update(current!.id as string, {
      sortOrder: current!.sortOrder,
    });

    await CategoryModel.update(previousValue!.id as string, {
      sortOrder: previousValue.sortOrder,
    });

    return current!;
  }

  async delete(id: string) {
    // TODO: check if category is being used in a catalog

    return await CategoryModel.delete(id);
  }

  async getDefaultCategory(type: string): Promise<Category | null> {
    const defaultCategory = await CategoryModel.findOne([
      {
        field: "type",
        op: "==",
        value: type,
      },
      {
        field: "default",
        op: "==",
        value: true,
      },
    ]);

    if (!defaultCategory) {
      return null;
    }

    return defaultCategory;
  }

  validate(category: Category): void {
    if (!category.name) {
      serverError("O nome do catálogo é obrigatório");
    }
  }

  getTypes(): CategoryTypeSelectElement[] {
    return [
      {
        value: "product",
        label: "Mercadoria",
      },
      {
        value: "menu",
        label: "Cardapío",
      },
    ];
  }
}

export class CategoryPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.CategoryWhereInput) {
    if (!where) {
      return await this.client.category.findMany();
    }

    return await this.client.category.findMany({ where });
  }

  async findById(id: string) {
    return await this.client.category.findUnique({ where: { id } });
  }

  async create(data: Prisma.CategoryCreateInput) {
    return await this.client.category.create({ data });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return await this.client.category.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.category.delete({ where: { id } });
  }
}

export const categoryEntity = new CategoryEntity(CategoryModel);
export const categoryPrismaEntity = new CategoryPrismaEntity({
  client: prismaClient,
});
