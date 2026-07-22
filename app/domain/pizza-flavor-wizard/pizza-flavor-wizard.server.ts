import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";
import createUUID from "~/utils/uuid";

const PIZZA_VARIATION_CODES = [
  "pizza-individual",
  "pizza-small",
  "pizza-medium",
  "pizza-bigger",
] as const;

export type PizzaFlavorIngredientInput = {
  itemId: string | null;
  name: string;
  section: "base" | "filling";
};

function normalizeIngredientName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type IngredientQuantityAverage = {
  quantity: number;
  unit: string;
  sampleCount: number;
};

export async function loadVisiblePizzaIngredientQuantityAverages(params: {
  db: any;
  ingredientItems: Array<{ id: string; consumptionUm?: string | null }>;
  variationCodes: string[];
}) {
  const ingredientIds = params.ingredientItems.map((item) => item.id);
  if (!ingredientIds.length || !params.variationCodes.length) {
    return new Map<string, IngredientQuantityAverage>();
  }

  const flavorItems = await params.db.item.findMany({
    where: {
      active: true,
      canSell: true,
      ItemSellingInfo: { is: { upcoming: false } },
      ItemSellingChannelItem: {
        some: {
          visible: true,
          ItemSellingChannel: { is: { key: "cardapio" } },
        },
      },
      ItemVariation: {
        some: { deletedAt: null, Recipe: { is: { type: "pizzaTopping" } } },
      },
    },
    select: {
      ItemVariation: {
        where: {
          deletedAt: null,
          Variation: { is: { code: { in: params.variationCodes } } },
          Recipe: { is: { type: "pizzaTopping" } },
        },
        select: {
          id: true,
          Variation: { select: { code: true } },
          Recipe: {
            select: {
              RecipeIngredient: {
                where: { ingredientItemId: { in: ingredientIds } },
                select: {
                  ingredientItemId: true,
                  RecipeVariationIngredient: {
                    select: {
                      itemVariationId: true,
                      quantity: true,
                      unit: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const samplesByKey = new Map<string, number[]>();
  for (const flavorItem of flavorItems) {
    for (const itemVariation of flavorItem.ItemVariation || []) {
      const variationCode = String(itemVariation.Variation?.code || "");
      for (const ingredient of itemVariation.Recipe?.RecipeIngredient || []) {
        const sample = (ingredient.RecipeVariationIngredient || []).find(
          (row: any) => row.itemVariationId === itemVariation.id
        );
        const quantity = Number(sample?.quantity || 0);
        const unit = String(sample?.unit || "")
          .trim()
          .toUpperCase();
        if (!(quantity > 0) || !unit) continue;
        const key = `${ingredient.ingredientItemId}:${variationCode}:${unit}`;
        samplesByKey.set(key, [...(samplesByKey.get(key) || []), quantity]);
      }
    }
  }

  const result = new Map<string, IngredientQuantityAverage>();
  for (const ingredientItem of params.ingredientItems) {
    for (const variationCode of params.variationCodes) {
      const preferredUnit = String(ingredientItem.consumptionUm || "")
        .trim()
        .toUpperCase();
      const candidates = Array.from(samplesByKey.entries())
        .filter(([key]) =>
          key.startsWith(`${ingredientItem.id}:${variationCode}:`)
        )
        .map(([key, quantities]) => ({
          unit: key.split(":").at(-1) || "",
          quantities,
        }));
      const selected =
        candidates.find((candidate) => candidate.unit === preferredUnit) ||
        candidates.sort((a, b) => b.quantities.length - a.quantities.length)[0];
      if (!selected?.quantities.length) continue;
      const average =
        selected.quantities.reduce((sum, quantity) => sum + quantity, 0) /
        selected.quantities.length;
      result.set(`${ingredientItem.id}:${variationCode}`, {
        quantity: Number(average.toFixed(6)),
        unit: selected.unit,
        sampleCount: selected.quantities.length,
      });
    }
  }

  return result;
}

export async function loadPizzaFlavorWizardCatalog() {
  const db = prismaClient as any;
  const [ingredients, category, savoryPizzaGroup, variations] =
    await Promise.all([
      db.item.findMany({
        where: {
          active: true,
          classification: { in: ["insumo", "semi_acabado"] },
        },
        select: {
          id: true,
          name: true,
          classification: true,
          consumptionUm: true,
        },
        orderBy: [{ name: "asc" }],
        take: 1500,
      }),
      db.category.findFirst({
        where: { name: { equals: "Sabor Pizza", mode: "insensitive" } },
        select: { id: true, name: true },
      }),
      db.itemGroup.findFirst({
        where: {
          name: { equals: "Pizzas Salgadas", mode: "insensitive" },
          deletedAt: null,
        },
        select: { id: true, name: true },
      }),
      db.variation.findMany({
        where: { code: { in: [...PIZZA_VARIATION_CODES] }, deletedAt: null },
        select: { id: true, code: true, name: true, sortOrderIndex: true },
        orderBy: [{ sortOrderIndex: "asc" }],
      }),
    ]);

  return {
    ingredients,
    ready:
      Boolean(category) &&
      Boolean(savoryPizzaGroup) &&
      variations.length === PIZZA_VARIATION_CODES.length,
    setupMessage: !category
      ? "A categoria Sabor Pizza não foi encontrada."
      : !savoryPizzaGroup
      ? "O grupo Pizzas Salgadas não foi encontrado."
      : variations.length !== PIZZA_VARIATION_CODES.length
      ? "Um ou mais tamanhos padrão não foram encontrados."
      : null,
  };
}

export async function createPizzaFlavor(params: {
  name: string;
  ingredients: PizzaFlavorIngredientInput[];
  variationCodes: string[];
}) {
  const db = prismaClient as any;
  const requestedName = params.name.trim();
  const name = requestedName || `Sabor em criação #${createUUID().slice(0, 8)}`;
  if (params.ingredients.length === 0)
    throw new Error("Confirme pelo menos um ingrediente");
  if (!params.ingredients.some((row) => row.section === "base"))
    throw new Error("Confirme pelo menos um ingrediente da base");
  if (!params.ingredients.some((row) => row.section === "filling"))
    throw new Error("Confirme pelo menos um ingrediente do recheio");
  const selectedVariationCodes = PIZZA_VARIATION_CODES.filter((code) =>
    params.variationCodes.includes(code)
  );
  if (!selectedVariationCodes.length)
    throw new Error("Selecione pelo menos um tamanho");

  const result = await db.$transaction(async (tx: any) => {
    const resolvedInputs = params.ingredients.filter((row) => row.itemId);
    const pendingInputs = params.ingredients.filter((row) => !row.itemId);
    const existing = await tx.item.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) throw new Error("Já existe um item com este nome");

    const [category, savoryPizzaGroup, variations, ingredientItems] =
      await Promise.all([
        tx.category.findFirst({
          where: { name: { equals: "Sabor Pizza", mode: "insensitive" } },
          select: { id: true },
        }),
        tx.itemGroup.findFirst({
          where: {
            name: { equals: "Pizzas Salgadas", mode: "insensitive" },
            deletedAt: null,
          },
          select: { id: true },
        }),
        tx.variation.findMany({
          where: { code: { in: selectedVariationCodes }, deletedAt: null },
          orderBy: [{ sortOrderIndex: "asc" }],
        }),
        tx.item.findMany({
          where: {
            id: { in: resolvedInputs.map((row) => String(row.itemId)) },
            active: true,
            classification: { in: ["insumo", "semi_acabado"] },
          },
          select: { id: true, name: true, consumptionUm: true },
        }),
      ]);

    if (!category) throw new Error("Categoria Sabor Pizza não encontrada");
    if (!savoryPizzaGroup)
      throw new Error("Grupo Pizzas Salgadas não encontrado");
    if (variations.length !== selectedVariationCodes.length) {
      throw new Error("Um ou mais tamanhos selecionados não estão disponíveis");
    }
    if (ingredientItems.length !== resolvedInputs.length) {
      throw new Error(
        "Um ou mais ingredientes confirmados não estão disponíveis"
      );
    }
    const ingredientQuantityAverages =
      await loadVisiblePizzaIngredientQuantityAverages({
        db: tx,
        ingredientItems,
        variationCodes: selectedVariationCodes,
      });

    const item = await tx.item.create({
      data: {
        name,
        classification: "produto_final",
        categoryId: category.id,
        active: true,
        canPurchase: false,
        canTransform: true,
        canSell: true,
        canStock: true,
      },
    });

    await tx.itemSellingInfo.create({
      data: {
        itemId: item.id,
        upcoming: true,
        itemGroupId: savoryPizzaGroup.id,
        baseIngredients: params.ingredients
          .filter((row) => row.section === "base")
          .map((row) =>
            row.itemId
              ? ingredientItems.find((item: any) => item.id === row.itemId)
                  ?.name
              : row.name
          )
          .filter(Boolean)
          .join(", "),
        ingredients: params.ingredients
          .filter((row) => row.section === "filling")
          .map((row) =>
            row.itemId
              ? ingredientItems.find((item: any) => item.id === row.itemId)
                  ?.name
              : row.name
          )
          .filter(Boolean)
          .join(", "),
      },
    });

    const recipe = await tx.recipe.create({
      data: {
        name,
        itemId: item.id,
        type: "pizzaTopping",
        costingMode: "per_variation",
        hasVariations: true,
      },
    });

    if (pendingInputs.length) {
      await tx.recipePendingIngredient.createMany({
        data: pendingInputs.map((row) => ({
          recipeId: recipe.id,
          name: row.name.trim(),
          normalizedName: normalizeIngredientName(row.name),
          section: row.section,
        })),
      });
    }

    const itemVariations = [] as any[];
    const referenceVariation =
      variations.find((row: any) => row.code === "pizza-medium") ||
      variations[0];
    for (const variation of variations) {
      itemVariations.push(
        await tx.itemVariation.create({
          data: {
            itemId: item.id,
            variationId: variation.id,
            recipeId: recipe.id,
            isReference: variation.id === referenceVariation.id,
          },
          include: { Variation: true },
        })
      );
    }

    for (const [index, ingredientInput] of resolvedInputs.entries()) {
      const ingredientItem = ingredientItems.find(
        (row: any) => row.id === ingredientInput.itemId
      );
      const recipeIngredient = await tx.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          ingredientItemId: String(ingredientInput.itemId),
          sortOrderIndex: index,
        },
      });
      await tx.recipeVariationIngredient.createMany({
        data: itemVariations.map((itemVariation) => {
          const average = ingredientQuantityAverages.get(
            `${ingredientInput.itemId}:${itemVariation.Variation.code}`
          );
          return {
            recipeIngredientId: recipeIngredient.id,
            itemVariationId: itemVariation.id,
            unit: average?.unit || ingredientItem?.consumptionUm || "UN",
            quantity: average?.quantity || 0,
          };
        }),
      });
    }

    const primaryItemVariation =
      itemVariations.find((row) => row.Variation.code === "pizza-medium") ||
      itemVariations[0];
    const rootSheetId = createUUID();
    for (const itemVariation of [
      primaryItemVariation,
      ...itemVariations.filter((row) => row.id !== primaryItemVariation.id),
    ]) {
      await tx.itemCostSheet.create({
        data: {
          id:
            itemVariation.id === primaryItemVariation.id
              ? rootSheetId
              : createUUID(),
          itemId: item.id,
          itemVariationId: itemVariation.id,
          name: `Ficha tecnica ${name}`,
          description: `Ficha tecnica gerada pelo cadastro rápido do sabor ${name}`,
          version: 1,
          status: "draft",
          isActive: false,
          baseItemCostSheetId:
            itemVariation.id === primaryItemVariation.id ? null : rootSheetId,
        },
      });
    }

    await tx.itemCostSheetComponent.create({
      data: {
        itemCostSheetId: rootSheetId,
        type: "recipe",
        refId: recipe.id,
        name: recipe.name,
        notes: "Receita criada pelo cadastro rápido de sabor de pizza",
        ItemCostSheetVariationComponent: {
          create: itemVariations.map((row) => ({
            itemVariationId: row.id,
            unit: "receita",
            quantity: 1,
            unitCostAmount: 0,
            wastePerc: 0,
            totalCostAmount: 0,
          })),
        },
      },
    });

    return {
      itemId: item.id,
      recipeId: recipe.id,
      itemCostSheetId: rootSheetId,
      name,
      pendingIngredientCount: pendingInputs.length,
      temporaryName: !requestedName,
    };
  });

  await invalidateCardapioIndexCache().catch((error) => {
    console.error(
      "[pizza-flavor-wizard] sabor criado, mas o cache do cardápio não foi invalidado",
      error
    );
  });
  return result;
}
