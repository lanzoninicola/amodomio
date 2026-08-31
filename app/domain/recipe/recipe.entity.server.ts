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
    return await this.client.recipe.findUnique({
      where: { id },
      include: {
        RecipePreheating: true,
        RecipeBaking: true,
      },
    });
  }

  async create(data: Prisma.RecipeCreateInput) {
    return await this.client.recipe.create({ data });
  }

  async update(id: string, data: Prisma.RecipeUpdateInput) {
    return await this.client.recipe.update({ where: { id }, data });
  }

  async duplicate(id: string, options?: { asVersion?: boolean }) {
    const client = this.client as any;

    const recipe = await client.recipe.findUnique({
      where: { id },
      include: {
        RecipePreheating: true,
        RecipeBaking: true,
        PendingIngredient: true,
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
      const asVersion = Boolean(options?.asVersion);
      const latestVersion = asVersion
        ? await tx.recipe.aggregate({
            where: { groupId: recipe.groupId },
            _max: { version: true },
          })
        : null;
      const duplicatedRecipe = await tx.recipe.create({
        data: {
          name: asVersion ? recipe.name : await buildCopyName(tx),
          groupId: asVersion ? recipe.groupId : undefined,
          version: asVersion
            ? Number(latestVersion?._max?.version || recipe.version || 0) + 1
            : 1,
          status: "draft",
          activatedAt: null,
          archivedAt: null,
          itemId: recipe.itemId,
          variationId: recipe.variationId,
          type: recipe.type,
          costingMode: recipe.costingMode || "per_variation",
          yieldQuantity:
            recipe.yieldQuantity == null
              ? null
              : Number(recipe.yieldQuantity || 0),
          yieldUnit: recipe.yieldUnit || null,
          description: recipe.description || "",
          productionProcedure: recipe.productionProcedure || null,
          productionNotes: recipe.productionNotes || null,
          hasVariations: Boolean(recipe.hasVariations),
          isGlutenFree: Boolean(recipe.isGlutenFree),
          isVegetarian: Boolean(recipe.isVegetarian),
        },
      });

      if (
        Array.isArray(recipe.PendingIngredient) &&
        recipe.PendingIngredient.length > 0
      ) {
        await tx.recipePendingIngredient.createMany({
          data: recipe.PendingIngredient.map((ingredient: any) => ({
            recipeId: duplicatedRecipe.id,
            section: ingredient.section,
            name: ingredient.name,
            normalizedName: ingredient.normalizedName,
            status: ingredient.status,
          })),
        });
      }

      if (recipe.RecipePreheating) {
        await tx.recipePreheating.create({
          data: {
            recipeId: duplicatedRecipe.id,
            upperTemperatureCelsius:
              recipe.RecipePreheating.upperTemperatureCelsius,
            lowerTemperatureCelsius:
              recipe.RecipePreheating.lowerTemperatureCelsius,
            durationMinutes: recipe.RecipePreheating.durationMinutes,
            notes: recipe.RecipePreheating.notes,
          },
        });
      }

      if (recipe.RecipeBaking) {
        await tx.recipeBaking.create({
          data: {
            recipeId: duplicatedRecipe.id,
            upperTemperatureCelsius:
              recipe.RecipeBaking.upperTemperatureCelsius,
            lowerTemperatureCelsius:
              recipe.RecipeBaking.lowerTemperatureCelsius,
            durationMinutes: recipe.RecipeBaking.durationMinutes,
            notes: recipe.RecipeBaking.notes,
          },
        });
      }

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
              lossPct: line.lossPct == null ? null : Number(line.lossPct || 0),
            })),
          });
        }
      }

      if (!asVersion && recipe.itemId) {
        await tx.itemVariation.updateMany({
          where: {
            itemId: recipe.itemId,
            recipeId: duplicatedRecipe.id,
            deletedAt: null,
          },
          data: { recipeId: recipe.id },
        });
      }

      return duplicatedRecipe;
    });
  }

  async createDraftVersion(id: string) {
    return this.duplicate(id, { asVersion: true });
  }

  async activateVersion(id: string) {
    const client = this.client as any;

    return client.$transaction(async (tx: any) => {
      const recipe = await tx.recipe.findUnique({
        where: { id },
        select: { id: true, groupId: true, status: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");
      if (recipe.status === "active") return recipe;

      const now = new Date();
      const groupRecipes = await tx.recipe.findMany({
        where: { groupId: recipe.groupId },
        select: { id: true },
      });
      const groupRecipeIds = groupRecipes.map((row: any) => row.id);

      await tx.recipe.updateMany({
        where: { groupId: recipe.groupId, status: "active", id: { not: id } },
        data: { status: "archived", archivedAt: now },
      });
      const activated = await tx.recipe.update({
        where: { id },
        data: { status: "active", activatedAt: now, archivedAt: null },
      });

      await tx.itemVariation.updateMany({
        where: { recipeId: { in: groupRecipeIds }, deletedAt: null },
        data: { recipeId: id },
      });

      return activated;
    });
  }

  async archiveVersion(id: string) {
    const client = this.client as any;
    return client.$transaction(async (tx: any) => {
      const recipe = await tx.recipe.findUnique({
        where: { id },
        select: { id: true, itemId: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");
      const archived = await tx.recipe.update({
        where: { id },
        data: { status: "archived", archivedAt: new Date() },
      });
      await this.reassignVariationsAfterDeactivation(tx, recipe);
      return archived;
    });
  }

  async moveVersionToDraft(id: string) {
    const client = this.client as any;
    return client.$transaction(async (tx: any) => {
      const recipe = await tx.recipe.findUnique({
        where: { id },
        select: { id: true, itemId: true },
      });
      if (!recipe) throw new Error("Receita não encontrada");
      const draft = await tx.recipe.update({
        where: { id },
        data: { status: "draft", activatedAt: null, archivedAt: null },
      });
      await this.reassignVariationsAfterDeactivation(tx, recipe);
      return draft;
    });
  }

  private async reassignVariationsAfterDeactivation(
    tx: any,
    recipe: { id: string; itemId: string | null }
  ) {
    if (!recipe.itemId) return;
    const replacement = await tx.recipe.findFirst({
      where: {
        itemId: recipe.itemId,
        status: "active",
        id: { not: recipe.id },
      },
      select: { id: true },
      orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
    });
    if (!replacement) return;
    await tx.itemVariation.updateMany({
      where: {
        itemId: recipe.itemId,
        recipeId: recipe.id,
        deletedAt: null,
      },
      data: { recipeId: replacement.id },
    });
  }

  async delete(id: string) {
    const recipe = await this.client.recipe.findUnique({
      where: { id },
      select: { status: true },
    });
    if (recipe?.status === "active") {
      throw new Error(
        "A versão ativa não pode ser eliminada. Crie e ative outra versão primeiro."
      );
    }
    return await this.client.recipe.delete({ where: { id } });
  }
}

export const recipeEntity = new RecipeEntity({
  client: prismaClient,
});
