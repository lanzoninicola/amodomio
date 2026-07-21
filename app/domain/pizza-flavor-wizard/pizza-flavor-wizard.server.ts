import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";
import createUUID from "~/utils/uuid";

const PIZZA_VARIATION_CODES = [
  "pizza-big",
  "pizza-slice",
  "pizza-medium",
  "pizza-individual",
  "pizza-small",
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
      variations.some((row: any) => row.code === "pizza-medium"),
    setupMessage: !category
      ? "A categoria Sabor Pizza não foi encontrada."
      : !savoryPizzaGroup
      ? "O grupo Pizzas Salgadas não foi encontrado."
      : variations.length !== PIZZA_VARIATION_CODES.length
      ? "Alguns tamanhos do modelo Affumicata não foram encontrados."
      : null,
  };
}

export async function createPizzaFlavor(params: {
  name: string;
  ingredients: PizzaFlavorIngredientInput[];
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
          where: { code: { in: [...PIZZA_VARIATION_CODES] }, deletedAt: null },
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
    if (variations.length !== PIZZA_VARIATION_CODES.length) {
      throw new Error(
        "Os tamanhos padrão do sabor de pizza não estão completos"
      );
    }
    if (ingredientItems.length !== resolvedInputs.length) {
      throw new Error(
        "Um ou mais ingredientes confirmados não estão disponíveis"
      );
    }

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
    for (const variation of variations) {
      itemVariations.push(
        await tx.itemVariation.create({
          data: {
            itemId: item.id,
            variationId: variation.id,
            recipeId: recipe.id,
            isReference: variation.code === "pizza-medium",
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
        data: itemVariations.map((itemVariation) => ({
          recipeIngredientId: recipeIngredient.id,
          itemVariationId: itemVariation.id,
          unit: ingredientItem?.consumptionUm || "UN",
          quantity: 0,
        })),
      });
    }

    const medium = itemVariations.find(
      (row) => row.Variation.code === "pizza-medium"
    );
    const rootSheetId = createUUID();
    for (const itemVariation of [
      medium,
      ...itemVariations.filter((row) => row.id !== medium.id),
    ]) {
      await tx.itemCostSheet.create({
        data: {
          id: itemVariation.id === medium.id ? rootSheetId : createUUID(),
          itemId: item.id,
          itemVariationId: itemVariation.id,
          name: `Ficha tecnica ${name}`,
          description: `Ficha tecnica gerada pelo cadastro rápido do sabor ${name}`,
          version: 1,
          status: "draft",
          isActive: false,
          baseItemCostSheetId:
            itemVariation.id === medium.id ? null : rootSheetId,
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
