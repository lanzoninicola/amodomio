import {
  createRecipeCompositionIngredientSkeleton,
  deleteRecipeCompositionLine,
  listRecipeLinkedVariations,
  listRecipeCompositionLines,
  updateRecipeCompositionIngredientDefaultLoss,
  updateRecipeCompositionLine,
} from "./recipe-composition.server";

function parseDecimalInput(value: unknown): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function extractJsonPayloadFromText(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBraceIndex = raw.indexOf("{");
  const lastBraceIndex = raw.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return raw;
}

type ExternalRecipeIngredientPayload = {
  itemId?: unknown;
  itemName?: unknown;
  name?: unknown;
  classification?: unknown;
  unit?: unknown;
  defaultLossPct?: unknown;
  variationQuantities?: Record<string, unknown> | null;
};

type ExternalRecipeImportPayload = {
  recipe?: {
    name?: unknown;
    description?: unknown;
    type?: unknown;
    isVegetarian?: unknown;
    isGlutenFree?: unknown;
  } | null;
  ingredients?: ExternalRecipeIngredientPayload[];
  missingIngredients?: Array<{
    name?: unknown;
    unit?: unknown;
    notes?: unknown;
  }>;
};

export type ExternalRecipeImportMode = "replace_current" | "merge_current";

function normalizeRecipeType(value: unknown) {
  const normalized = String(value || "").trim();
  if (normalized === "pizzaTopping") return "pizzaTopping";
  return "semiFinished";
}

function normalizeItemClassification(value: unknown) {
  const normalized = String(value || "").trim();
  if (normalized === "semi_acabado") return "semi_acabado";
  return "insumo";
}

export function parseExternalRecipeChatGptImportPayload(value: string): {
  recipe: {
    name: string | null;
    description: string | null;
    type: "semiFinished" | "pizzaTopping";
    isVegetarian: boolean;
    isGlutenFree: boolean;
  };
  ingredients: Array<{
    sourceIndex: number;
    itemId: string | null;
    itemName: string | null;
    classification: "insumo" | "semi_acabado";
    unit: string;
    defaultLossPct: number;
    variationQuantities: Record<string, number>;
  }>;
  missingIngredients: Array<{
    name: string;
    unit: string | null;
    notes: string | null;
  }>;
} {
  const jsonPayload = extractJsonPayloadFromText(value);
  if (!jsonPayload) {
    throw new Error("Cole a resposta JSON do ChatGPT antes de importar");
  }

  let parsed: ExternalRecipeImportPayload;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (_error) {
    throw new Error("A resposta colada não contém um JSON válido");
  }

  const ingredientsRaw = Array.isArray(parsed?.ingredients)
    ? parsed.ingredients
    : [];
  const missingIngredientsRaw = Array.isArray(parsed?.missingIngredients)
    ? parsed.missingIngredients
    : [];
  if (ingredientsRaw.length === 0 && missingIngredientsRaw.length === 0) {
    throw new Error("Nenhum ingrediente encontrado no JSON importado");
  }

  const seenKeys = new Set<string>();
  const ingredients = ingredientsRaw.map((ingredient, index) => {
    const itemId = String(ingredient?.itemId || "").trim() || null;
    const itemName =
      String(ingredient?.itemName || ingredient?.name || "").trim() || null;
    const unit = String(ingredient?.unit || "")
      .trim()
      .toUpperCase();
    const defaultLossPctParsed = parseDecimalInput(ingredient?.defaultLossPct);
    const variationEntries = Object.entries(
      ingredient?.variationQuantities || {}
    );

    if (!itemId && !itemName) {
      throw new Error(
        `Ingrediente ${
          index + 1
        }: informe itemId existente ou itemName para criar`
      );
    }
    const uniqueKey = itemId
      ? `id:${itemId}`
      : `name:${itemName?.toLowerCase()}`;
    if (seenKeys.has(uniqueKey)) {
      throw new Error(`Ingrediente ${index + 1}: ingrediente duplicado`);
    }
    seenKeys.add(uniqueKey);
    if (!unit) throw new Error(`Ingrediente ${index + 1}: unit é obrigatório`);
    if (
      defaultLossPctParsed === null ||
      Number.isNaN(defaultLossPctParsed) ||
      defaultLossPctParsed < 0 ||
      defaultLossPctParsed >= 100
    ) {
      throw new Error(`Ingrediente ${index + 1}: defaultLossPct inválido`);
    }
    if (variationEntries.length === 0) {
      throw new Error(`Ingrediente ${index + 1}: informe variationQuantities`);
    }

    const variationQuantities = variationEntries.reduce(
      (acc, [variationKey, quantityRaw]) => {
        const quantity = parseDecimalInput(quantityRaw);
        if (!variationKey.trim()) {
          throw new Error(
            `Ingrediente ${index + 1}: chave de variação inválida`
          );
        }
        if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
          throw new Error(
            `Ingrediente ${
              index + 1
            }: quantidade inválida para a variação ${variationKey}`
          );
        }
        acc[String(variationKey).trim()] = quantity;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      sourceIndex: index,
      itemId,
      itemName,
      classification: normalizeItemClassification(ingredient?.classification),
      unit,
      defaultLossPct: defaultLossPctParsed,
      variationQuantities,
    };
  });

  const missingIngredients = missingIngredientsRaw.map((ingredient, index) => {
    const name = String(ingredient?.name || "").trim();
    const unitRaw = String(ingredient?.unit || "")
      .trim()
      .toUpperCase();
    const notes = String(ingredient?.notes || "").trim();
    if (!name)
      throw new Error(`Ingrediente faltante ${index + 1}: name é obrigatório`);
    return {
      name,
      unit: unitRaw || null,
      notes: notes || null,
    };
  });

  return {
    recipe: {
      name: String(parsed?.recipe?.name || "").trim() || null,
      description: String(parsed?.recipe?.description || "").trim() || null,
      type: normalizeRecipeType(parsed?.recipe?.type),
      isVegetarian: parsed?.recipe?.isVegetarian === true,
      isGlutenFree: parsed?.recipe?.isGlutenFree === true,
    },
    ingredients,
    missingIngredients,
  };
}

async function resolveExistingItemByName(db: any, itemName: string) {
  return db.item.findFirst({
    where: { name: { equals: itemName, mode: "insensitive" } },
    select: { id: true, name: true, consumptionUm: true, classification: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}

async function createIngredientItem(params: {
  db: any;
  name: string;
  unit: string;
  classification: "insumo" | "semi_acabado";
}) {
  const { db, name, unit, classification } = params;
  return db.item.create({
    data: {
      name,
      classification,
      consumptionUm: unit,
      active: true,
      canPurchase: classification === "insumo",
      canTransform: classification === "semi_acabado",
      canSell: false,
      canStock: true,
    },
    select: { id: true, name: true, consumptionUm: true, classification: true },
  });
}

export async function buildExternalRecipeChatGptImportPreview(params: {
  db: any;
  recipeId: string;
  payload: ReturnType<typeof parseExternalRecipeChatGptImportPayload>;
  importMode?: ExternalRecipeImportMode;
}) {
  const { db, recipeId, payload, importMode = "replace_current" } = params;
  const linkedVariations = await listRecipeLinkedVariations(db, recipeId);
  const linkedVariationIds = new Set(
    linkedVariations.map((variation: any) => String(variation.itemVariationId))
  );
  if (linkedVariationIds.size === 0) {
    throw new Error(
      "Configure ao menos uma variação na receita antes de usar o assistente"
    );
  }
  const variationNameById = new Map(
    linkedVariations.map((variation: any) => [
      String(variation.itemVariationId),
      variation.variationName || "Base",
    ])
  );

  const existingItemIds = payload.ingredients
    .map((ingredient) => ingredient.itemId)
    .filter(Boolean) as string[];
  const itemCatalog = await db.item.findMany({
    where: { id: { in: existingItemIds } },
    select: { id: true, name: true, consumptionUm: true, classification: true },
  });
  const itemById = new Map<string, any>(
    itemCatalog.map((item: any) => [String(item.id), item])
  );

  const importableIngredients = [];
  for (const ingredient of payload.ingredients) {
    const sourceIndex = ingredient.sourceIndex;
    const variationKeys = Object.keys(ingredient.variationQuantities);
    const invalidVariationId = variationKeys.find(
      (variationId) => !linkedVariationIds.has(variationId)
    );
    if (invalidVariationId) {
      throw new Error(`Variação inválida no JSON: ${invalidVariationId}`);
    }

    let item = ingredient.itemId ? itemById.get(ingredient.itemId) : null;
    if (ingredient.itemId && !item) {
      throw new Error(
        `Ingrediente não encontrado para itemId ${ingredient.itemId}`
      );
    }
    const existingByName =
      !item && ingredient.itemName
        ? await resolveExistingItemByName(db, ingredient.itemName)
        : null;
    item = item || existingByName;

    importableIngredients.push({
      sourceIndex,
      itemId: item?.id || null,
      itemName: item?.name || ingredient.itemName,
      requestedItemName: ingredient.itemName,
      classification: item?.classification || ingredient.classification,
      unit: ingredient.unit,
      defaultLossPct: ingredient.defaultLossPct,
      itemMode: item ? "reuse" : "create",
      variationCount: variationKeys.length,
      variations: variationKeys.map((variationId) => ({
        itemVariationId: variationId,
        variationName: String(variationNameById.get(variationId) || "Variação"),
        quantity: Number(ingredient.variationQuantities[variationId] || 0),
      })),
    });
  }

  return {
    preview: {
      recipe: {
        name: payload.recipe.name,
        type: payload.recipe.type,
        importMode,
        effectDescription:
          importMode === "replace_current"
            ? "A composição atual será removida e recriada com os ingredientes do JSON."
            : "Ingredientes do JSON serão criados/atualizados sem apagar os demais ingredientes atuais.",
      },
      importableIngredients,
      missingIngredients: payload.missingIngredients,
      totals: {
        importableIngredients: importableIngredients.length,
        itemsToCreate: importableIngredients.filter(
          (ingredient) => ingredient.itemMode === "create"
        ).length,
        missingIngredients: payload.missingIngredients.length,
        variationCells: importableIngredients.reduce(
          (acc, ingredient) => acc + ingredient.variationCount,
          0
        ),
      },
    },
  };
}

export async function importExternalRecipeFromChatGpt(params: {
  db: any;
  recipeId: string;
  payload: ReturnType<typeof parseExternalRecipeChatGptImportPayload>;
  importMode?: ExternalRecipeImportMode;
}) {
  const { db, recipeId, payload, importMode = "replace_current" } = params;
  await buildExternalRecipeChatGptImportPreview({
    db,
    recipeId,
    payload,
    importMode,
  });

  if (payload.recipe.name) {
    await db.recipe.update({
      where: { id: recipeId },
      data: {
        name: payload.recipe.name,
        description: payload.recipe.description,
        type: payload.recipe.type,
        isVegetarian: payload.recipe.isVegetarian,
        isGlutenFree: payload.recipe.isGlutenFree,
      },
    });
  }

  if (importMode === "replace_current") {
    const existingLines = await listRecipeCompositionLines(db, recipeId);
    for (const line of existingLines) {
      await deleteRecipeCompositionLine(db, String(line.id));
    }
  }

  let createdItemCount = 0;
  const resolvedIngredients = [];
  for (const ingredient of payload.ingredients) {
    let item = ingredient.itemId
      ? await db.item.findUnique({
          where: { id: ingredient.itemId },
          select: {
            id: true,
            name: true,
            consumptionUm: true,
            classification: true,
          },
        })
      : null;
    if (!item && ingredient.itemName) {
      item = await resolveExistingItemByName(db, ingredient.itemName);
    }
    if (!item && ingredient.itemName) {
      item = await createIngredientItem({
        db,
        name: ingredient.itemName,
        unit: ingredient.unit,
        classification: ingredient.classification,
      });
      createdItemCount += 1;
    }
    if (!item) {
      throw new Error(
        "Não foi possível criar ou localizar um ingrediente do JSON"
      );
    }
    resolvedIngredients.push({ ...ingredient, itemId: String(item.id), item });
  }

  for (const ingredient of resolvedIngredients) {
    await createRecipeCompositionIngredientSkeleton({
      db,
      recipeId,
      itemId: ingredient.itemId,
      defaultUnit: ingredient.unit,
      defaultLossPct: ingredient.defaultLossPct,
    });
  }

  const refreshedLines = await listRecipeCompositionLines(db, recipeId);
  const ingredientByItemId = new Map<string, string>();
  const lineByItemAndVariation = new Map<string, any>();

  for (const line of refreshedLines) {
    if (line.recipeIngredientId) {
      ingredientByItemId.set(
        String(line.itemId),
        String(line.recipeIngredientId)
      );
    }
    const itemVariationId = String(line.ItemVariation?.id || "");
    if (itemVariationId) {
      lineByItemAndVariation.set(`${line.itemId}::${itemVariationId}`, line);
    }
  }

  for (const ingredient of resolvedIngredients) {
    const recipeIngredientId = ingredientByItemId.get(ingredient.itemId);
    if (!recipeIngredientId) {
      throw new Error(
        `Não foi possível preparar a composição para o item ${ingredient.itemId}`
      );
    }

    await updateRecipeCompositionIngredientDefaultLoss({
      db,
      recipeId,
      recipeIngredientId,
      defaultLossPct: ingredient.defaultLossPct,
      applyToVariationLines: false,
    });

    for (const [itemVariationId, quantity] of Object.entries(
      ingredient.variationQuantities
    )) {
      const line = lineByItemAndVariation.get(
        `${ingredient.itemId}::${itemVariationId}`
      );
      if (!line) {
        throw new Error(
          `Linha não encontrada para item ${ingredient.itemId} na variação ${itemVariationId}`
        );
      }

      await updateRecipeCompositionLine({
        db,
        lineId: line.id,
        recipeId,
        unit: ingredient.unit,
        quantity,
        lossPct: ingredient.defaultLossPct,
      });
    }
  }

  return {
    recipeId,
    createdItems: createdItemCount,
  };
}
