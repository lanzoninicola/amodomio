import prismaClient from "~/lib/prisma/client.server";
import { Prisma, RecipeType } from "@prisma/client";
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

  async create(data: Prisma.RecipeCreateInput) {
    return await this.client.recipe.create({ data });
  }

  async update(id: string, data: Prisma.RecipeUpdateInput) {
    return await this.client.recipe.update({ where: { id }, data });
  }

  async duplicate(id: string) {
    const client = this.client as any;

    const recipe = await client.recipe.findUnique({
      where: { id },
      include: {
        RecipeIngredient: {
          include: {
            RecipeVariationIngredient: {
              select: {
                itemVariationId: true,
                unit: true,
                quantity: true,
                lossPct: true,
              },
              orderBy: [{ createdAt: "asc" }],
            },
          },
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!recipe) {
      throw new Error("Receita não encontrada");
    }

    const buildCopyName = async (db: any) => {
      const baseName = `${recipe.name} (cópia)`;
      let nextName = baseName;
      let suffix = 2;

      while (
        await db.recipe.findFirst({
          where: { name: nextName },
          select: { id: true },
        })
      ) {
        nextName = `${baseName} ${suffix}`;
        suffix += 1;
      }

      return nextName;
    };

    return await client.$transaction(async (tx: any) => {
      const duplicatedRecipe = await tx.recipe.create({
        data: {
          name: await buildCopyName(tx),
          itemId: recipe.itemId,
          variationId: recipe.variationId,
          type: recipe.type,
          description: recipe.description || "",
          hasVariations: Boolean(recipe.hasVariations),
          isGlutenFree: Boolean(recipe.isGlutenFree),
          isVegetarian: Boolean(recipe.isVegetarian),
        },
      });

      for (const ingredient of recipe.RecipeIngredient || []) {
        const duplicatedIngredient = await tx.recipeIngredient.create({
          data: {
            recipeId: duplicatedRecipe.id,
            ingredientItemId: ingredient.ingredientItemId,
            defaultLossPct: Number(ingredient.defaultLossPct || 0),
            sortOrderIndex: Number(ingredient.sortOrderIndex || 0),
            notes: ingredient.notes || null,
          },
        });

        if (
          Array.isArray(ingredient.RecipeVariationIngredient) &&
          ingredient.RecipeVariationIngredient.length > 0
        ) {
          await tx.recipeVariationIngredient.createMany({
            data: ingredient.RecipeVariationIngredient.map((line: any) => ({
              recipeIngredientId: duplicatedIngredient.id,
              itemVariationId: line.itemVariationId,
              unit: line.unit,
              quantity: Number(line.quantity || 0),
              lossPct:
                line.lossPct == null ? null : Number(line.lossPct || 0),
            })),
          });
        }
      }

      return duplicatedRecipe;
    });
  }

  async delete(id: string) {
    return await this.client.recipe.delete({ where: { id } });
  }
}

export const recipeEntity = new RecipeEntity({
  client: prismaClient,
});
