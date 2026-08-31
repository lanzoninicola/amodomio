import { describe, expect, it, vi } from "vitest";
import { RecipeEntity } from "./recipe.entity.server";

describe("RecipeEntity lifecycle", () => {
  it("duplicates every recipe-owned record with new ids without moving item variation links", async () => {
    const sourceRecipe = {
      id: "recipe-v1",
      groupId: "recipe-group",
      version: 1,
      name: "Delicatissima",
      itemId: "item-1",
      variationId: null,
      type: "pizzaTopping",
      costingMode: "per_variation",
      yieldQuantity: null,
      yieldUnit: null,
      description: "",
      productionProcedure: null,
      productionNotes: null,
      hasVariations: true,
      isGlutenFree: false,
      isVegetarian: false,
      RecipePreheating: null,
      RecipeBaking: null,
      PendingIngredient: [],
      RecipeIngredient: [
        {
          id: "old-recipe-ingredient",
          ingredientItemId: "ingredient-item-1",
          defaultLossPct: 2,
          sortOrderIndex: 0,
          notes: null,
          RecipeVariationIngredient: [
            {
              itemVariationId: "item-variation-1",
              unit: "g",
              quantity: 100,
              lossPct: 1,
            },
          ],
        },
      ],
    };
    const duplicatedRecipe = {
      id: "recipe-copy",
      status: "draft",
      version: 1,
    };
    const duplicatedIngredient = { id: "new-recipe-ingredient" };
    const tx = {
      recipe: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(duplicatedRecipe),
      },
      recipeIngredient: {
        create: vi.fn().mockResolvedValue(duplicatedIngredient),
      },
      recipeVariationIngredient: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      itemVariation: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const client = {
      recipe: { findUnique: vi.fn().mockResolvedValue(sourceRecipe) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const entity = new RecipeEntity({ client } as any);

    await expect(entity.duplicate("recipe-v1")).resolves.toEqual(
      duplicatedRecipe
    );
    expect(tx.recipeIngredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipeId: "recipe-copy",
        ingredientItemId: "ingredient-item-1",
      }),
    });
    expect(tx.recipeVariationIngredient.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipeIngredientId: "new-recipe-ingredient",
          itemVariationId: "item-variation-1",
        }),
      ],
    });
    expect(tx.itemVariation.updateMany).toHaveBeenCalledWith({
      where: {
        itemId: "item-1",
        recipeId: "recipe-copy",
        deletedAt: null,
      },
      data: { recipeId: "recipe-v1" },
    });
  });

  it("creates the next version as a draft in the same recipe group", async () => {
    const sourceRecipe = {
      id: "recipe-v1",
      groupId: "recipe-group",
      version: 1,
      name: "Calabresa",
      itemId: "item-1",
      variationId: null,
      type: "pizzaTopping",
      costingMode: "per_variation",
      yieldQuantity: null,
      yieldUnit: null,
      description: "",
      productionProcedure: null,
      productionNotes: null,
      hasVariations: false,
      isGlutenFree: false,
      isVegetarian: false,
      RecipePreheating: null,
      RecipeBaking: null,
      PendingIngredient: [],
      RecipeIngredient: [],
    };
    const createdRecipe = { id: "recipe-v2", status: "draft", version: 2 };
    const tx = {
      recipe: {
        aggregate: vi.fn().mockResolvedValue({ _max: { version: 1 } }),
        create: vi.fn().mockResolvedValue(createdRecipe),
      },
    };
    const client = {
      recipe: { findUnique: vi.fn().mockResolvedValue(sourceRecipe) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const entity = new RecipeEntity({ client } as any);

    await expect(entity.createDraftVersion("recipe-v1")).resolves.toEqual(
      createdRecipe
    );
    expect(tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Calabresa",
        groupId: "recipe-group",
        version: 2,
        status: "draft",
      }),
    });
  });

  it("archives the previous active version and activates the selected version atomically", async () => {
    const activated = { id: "recipe-v2", status: "active" };
    const tx = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({
          id: "recipe-v2",
          groupId: "recipe-group",
          status: "draft",
        }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "recipe-v1" }, { id: "recipe-v2" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(activated),
      },
      itemVariation: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const entity = new RecipeEntity({ client } as any);

    await expect(entity.activateVersion("recipe-v2")).resolves.toEqual(
      activated
    );
    expect(tx.recipe.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId: "recipe-group",
          status: "active",
          id: { not: "recipe-v2" },
        },
        data: expect.objectContaining({ status: "archived" }),
      })
    );
    expect(tx.itemVariation.updateMany).toHaveBeenCalledWith({
      where: {
        recipeId: { in: ["recipe-v1", "recipe-v2"] },
        deletedAt: null,
      },
      data: { recipeId: "recipe-v2" },
    });
  });

  it("does not allow deleting the active recipe version", async () => {
    const client = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({ status: "active" }),
        delete: vi.fn(),
      },
    };
    const entity = new RecipeEntity({ client } as any);

    await expect(entity.delete("recipe-v1")).rejects.toThrow(
      "A versão ativa não pode ser eliminada"
    );
    expect(client.recipe.delete).not.toHaveBeenCalled();
  });

  it("allows managing archived and draft status explicitly", async () => {
    const tx = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({
          id: "recipe-v1",
          itemId: "item-1",
          status: "active",
        }),
        findFirst: vi.fn().mockResolvedValue({ id: "recipe-active" }),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            id: "recipe-v1",
            status: "archived",
          })
          .mockResolvedValueOnce({
            id: "recipe-v1",
            status: "draft",
          }),
      },
      itemVariation: {
        updateMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const entity = new RecipeEntity({ client } as any);

    await expect(entity.archiveVersion("recipe-v1")).resolves.toMatchObject({
      status: "archived",
    });
    await expect(entity.moveVersionToDraft("recipe-v1")).resolves.toMatchObject(
      { status: "draft" }
    );
    expect(tx.recipe.update).toHaveBeenLastCalledWith({
      where: { id: "recipe-v1" },
      data: { status: "draft", activatedAt: null, archivedAt: null },
    });
    expect(tx.itemVariation.updateMany).toHaveBeenLastCalledWith({
      where: {
        itemId: "item-1",
        recipeId: "recipe-v1",
        deletedAt: null,
      },
      data: { recipeId: "recipe-active" },
    });
  });
});
