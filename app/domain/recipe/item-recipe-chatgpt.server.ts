import {
  createRecipeCompositionIngredientSkeleton,
  deleteRecipeCompositionLine,
  listRecipeCompositionLines,
  updateRecipeCompositionIngredientDefaultLoss,
  updateRecipeCompositionLine,
} from "~/domain/recipe/recipe-composition.server";
import {
  ensureItemCostSheetForRecipe as ensureItemCostSheetForRecipeLink,
} from "~/domain/recipe/recipe-item-cost-sheet.server";

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

type ItemRecipeChatGptImportIngredient = {
  itemId?: unknown;
  unit?: unknown;
  defaultLossPct?: unknown;
  variationQuantities?: Record<string, unknown> | null;
};

type ItemRecipeChatGptImportPayload = {
  recipe?: {
    name?: unknown;
    description?: unknown;
    type?: unknown;
    isVegetarian?: unknown;
    isGlutenFree?: unknown;
  } | null;
  ingredients?: ItemRecipeChatGptImportIngredient[];
  missingIngredients?: Array<{
    name?: unknown;
    unit?: unknown;
    notes?: unknown;
  }>;
};

function normalizeRecipeType(value: unknown) {
  const normalized = String(value || "").trim();
  if (normalized === "pizzaTopping") return "pizzaTopping";
  return "semiFinished";
}

export function parseItemRecipeChatGptImportPayload(value: string): {
  recipe: {
    name: string;
    description: string | null;
    type: "semiFinished" | "pizzaTopping";
    isVegetarian: boolean;
    isGlutenFree: boolean;
  };
  ingredients: Array<{
    itemId: string;
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

  let parsed: ItemRecipeChatGptImportPayload;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (_error) {
    throw new Error("A resposta colada não contém um JSON válido");
  }

  const recipeName = String(parsed?.recipe?.name || "").trim();
  if (!recipeName) {
    throw new Error("recipe.name é obrigatório");
  }

  const ingredientsRaw = Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
  const missingIngredientsRaw = Array.isArray(parsed?.missingIngredients) ? parsed.missingIngredients : [];
  if (ingredientsRaw.length === 0 && missingIngredientsRaw.length === 0) {
    throw new Error("Nenhum ingrediente encontrado no JSON importado");
  }

  const seenItemIds = new Set<string>();
  const ingredients = ingredientsRaw.map((ingredient, index) => {
    const itemId = String(ingredient?.itemId || "").trim();
    const unit = String(ingredient?.unit || "").trim().toUpperCase();
    const defaultLossPctParsed = parseDecimalInput(ingredient?.defaultLossPct);
    const variationEntries = Object.entries(ingredient?.variationQuantities || {});

    if (!itemId) throw new Error(`Ingrediente ${index + 1}: itemId é obrigatório`);
    if (seenItemIds.has(itemId)) throw new Error(`Ingrediente ${index + 1}: itemId duplicado (${itemId})`);
    seenItemIds.add(itemId);
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

    const variationQuantities = variationEntries.reduce((acc, [variationKey, quantityRaw]) => {
      const quantity = parseDecimalInput(quantityRaw);
      if (!variationKey.trim()) {
        throw new Error(`Ingrediente ${index + 1}: chave de variação inválida`);
      }
      if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
        throw new Error(`Ingrediente ${index + 1}: quantidade inválida para a variação ${variationKey}`);
      }
      acc[String(variationKey).trim()] = quantity;
      return acc;
    }, {} as Record<string, number>);

    return {
      itemId,
      unit,
      defaultLossPct: defaultLossPctParsed,
      variationQuantities,
    };
  });

  const missingIngredients = missingIngredientsRaw.map((ingredient, index) => {
    const name = String(ingredient?.name || "").trim();
    const unitRaw = String(ingredient?.unit || "").trim().toUpperCase();
    const notes = String(ingredient?.notes || "").trim();
    if (!name) throw new Error(`Ingrediente faltante ${index + 1}: name é obrigatório`);
    return {
      name,
      unit: unitRaw || null,
      notes: notes || null,
    };
  });

  return {
    recipe: {
      name: recipeName,
      description: String(parsed?.recipe?.description || "").trim() || null,
      type: normalizeRecipeType(parsed?.recipe?.type),
      isVegetarian: parsed?.recipe?.isVegetarian === true,
      isGlutenFree: parsed?.recipe?.isGlutenFree === true,
    },
    ingredients,
    missingIngredients,
  };
}

async function ensureSingleItemRecipeGroup(db: any, itemId: string) {
  const recipes = await db.recipe.findMany({
    where: { itemId },
    select: { id: true, name: true, createdAt: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
  });
  if (recipes.length > 1) {
    throw new Error("Este item já possui mais de uma receita vinculada. Use o módulo de receitas para escolher manualmente.");
  }
  return recipes[0] || null;
}

export type ExistingRecipeImportMode = "merge_existing" | "replace_existing";

async function ensureRecipeForItem(params: {
  db: any;
  item: any;
  recipePayload: {
    name: string;
    description: string | null;
    type: "semiFinished" | "pizzaTopping";
    isVegetarian: boolean;
    isGlutenFree: boolean;
  };
}) {
  const { db, item, recipePayload } = params;
  const existingRecipe = await ensureSingleItemRecipeGroup(db, item.id);

  if (existingRecipe) {
    return db.recipe.update({
      where: { id: existingRecipe.id },
      data: {
        name: recipePayload.name,
        description: recipePayload.description,
        type: recipePayload.type,
        isVegetarian: recipePayload.isVegetarian,
        isGlutenFree: recipePayload.isGlutenFree,
        itemId: item.id,
        variationId: null,
      },
    });
  }

  return db.recipe.create({
    data: {
      name: recipePayload.name,
      description: recipePayload.description,
      type: recipePayload.type,
      hasVariations: false,
      isVegetarian: recipePayload.isVegetarian,
      isGlutenFree: recipePayload.isGlutenFree,
      itemId: item.id,
      variationId: null,
    },
  });
}

async function ensureItemCostSheetForRecipe(params: {
  db: any;
  item: any;
  recipe: any;
}) {
  const { db, item, recipe } = params;
  const result = await ensureItemCostSheetForRecipeLink({
    db,
    item,
    recipe,
    componentNotes: "Componente gerado automaticamente pelo assistente de receita",
  });
  return result.rootSheetId;
}

export async function buildItemRecipeChatGptImportPreview(params: {
  db: any;
  item: any;
  payload: ReturnType<typeof parseItemRecipeChatGptImportPayload>;
  existingRecipeImportMode?: ExistingRecipeImportMode;
}) {
  const {
    db,
    item,
    payload,
    existingRecipeImportMode = "replace_existing",
  } = params;
  const itemCatalog = await db.item.findMany({
    where: { id: { in: payload.ingredients.map((ingredient) => ingredient.itemId) } },
    select: { id: true, name: true, consumptionUm: true },
  });
  const itemById = new Map<
    string,
    { id: string; name: string; consumptionUm?: string | null }
  >(
    itemCatalog.map((catalogItem: any) => [String(catalogItem.id), catalogItem])
  );

  const linkedVariations = (item.ItemVariation || []).map((variation: any) => ({
    itemVariationId: String(variation.id),
    variationName: variation?.Variation?.name || "Base",
  }));
  const linkedVariationIds = new Set(linkedVariations.map((variation) => variation.itemVariationId));
  const variationNameById = new Map(
    linkedVariations.map((variation) => [variation.itemVariationId, variation.variationName])
  );

  if (linkedVariations.length === 0) {
    throw new Error("Configure ao menos uma variação no item antes de usar o assistente");
  }

  const importableIngredients = payload.ingredients.map((ingredient) => {
    const catalogItem = itemById.get(ingredient.itemId);
    if (!catalogItem) throw new Error(`Ingrediente não encontrado para itemId ${ingredient.itemId}`);

    const variationKeys = Object.keys(ingredient.variationQuantities);
    const invalidVariationId = variationKeys.find((variationId) => !linkedVariationIds.has(variationId));
    if (invalidVariationId) {
      throw new Error(`Variação inválida no JSON: ${invalidVariationId}`);
    }

    return {
      itemId: ingredient.itemId,
      itemName: catalogItem.name,
      unit: ingredient.unit,
      defaultLossPct: ingredient.defaultLossPct,
      variationCount: variationKeys.length,
      variations: variationKeys.map((variationId) => ({
        itemVariationId: variationId,
        variationName: String(variationNameById.get(variationId) || "Variação"),
        quantity: Number(ingredient.variationQuantities[variationId] || 0),
      })),
    };
  });

  const existingRecipe = await ensureSingleItemRecipeGroup(db, item.id);
  const existingSheetRootId = await ensureSingleItemCostSheetGroup(db, item.id);

  return {
    itemById,
    preview: {
      recipe: {
        name: payload.recipe.name,
        type: payload.recipe.type,
        mode: existingRecipe ? "update" : "create",
        importMode: existingRecipe ? existingRecipeImportMode : null,
        effectDescription: existingRecipe
          ? existingRecipeImportMode === "merge_existing"
            ? "A receita atual será atualizada e os ingredientes antigos não citados no JSON serão mantidos."
            : "A composição atual da receita será limpa e recriada a partir do JSON importado."
          : "Uma nova receita vinculada será criada para o item.",
      },
      itemCostSheet: {
        mode: existingSheetRootId ? "reuse" : "create",
      },
      importableIngredients,
      missingIngredients: payload.missingIngredients,
      totals: {
        importableIngredients: importableIngredients.length,
        missingIngredients: payload.missingIngredients.length,
        variationCells: importableIngredients.reduce((acc, ingredient) => acc + ingredient.variationCount, 0),
      },
    },
  };
}

export async function importItemRecipeFromChatGpt(params: {
  db: any;
  item: any;
  payload: ReturnType<typeof parseItemRecipeChatGptImportPayload>;
  existingRecipeImportMode?: ExistingRecipeImportMode;
}) {
  const {
    db,
    item,
    payload,
    existingRecipeImportMode = "replace_existing",
  } = params;
  const { itemById } = await buildItemRecipeChatGptImportPreview({
    db,
    item,
    payload,
    existingRecipeImportMode,
  });
  const recipe = await ensureRecipeForItem({
    db,
    item,
    recipePayload: payload.recipe,
  });

  if (existingRecipeImportMode === "replace_existing") {
    const existingLines = await listRecipeCompositionLines(db, recipe.id);
    for (const line of existingLines) {
      await deleteRecipeCompositionLine(db, String(line.id));
    }
  }

  for (const ingredient of payload.ingredients) {
    const catalogItem = itemById.get(ingredient.itemId);
    const defaultUnit = String(ingredient.unit || catalogItem?.consumptionUm || "UN").trim().toUpperCase() || "UN";
    await createRecipeCompositionIngredientSkeleton({
      db,
      recipeId: recipe.id,
      itemId: ingredient.itemId,
      defaultUnit,
      defaultLossPct: ingredient.defaultLossPct,
    });
  }

  const refreshedLines = await listRecipeCompositionLines(db, recipe.id);
  const ingredientByItemId = new Map<string, string>();
  const lineByItemAndVariation = new Map<string, any>();

  for (const line of refreshedLines) {
    if (line.recipeIngredientId) {
      ingredientByItemId.set(String(line.itemId), String(line.recipeIngredientId));
    }
    const itemVariationId = String(line.ItemVariation?.id || "");
    if (itemVariationId) {
      lineByItemAndVariation.set(`${line.itemId}::${itemVariationId}`, line);
    }
  }

  for (const ingredient of payload.ingredients) {
    const recipeIngredientId = ingredientByItemId.get(ingredient.itemId);
    if (!recipeIngredientId) {
      throw new Error(`Não foi possível preparar a composição para o item ${ingredient.itemId}`);
    }

    await updateRecipeCompositionIngredientDefaultLoss({
      db,
      recipeId: recipe.id,
      recipeIngredientId,
      defaultLossPct: ingredient.defaultLossPct,
      applyToVariationLines: false,
    });

    for (const [itemVariationId, quantity] of Object.entries(ingredient.variationQuantities)) {
      const line = lineByItemAndVariation.get(`${ingredient.itemId}::${itemVariationId}`);
      if (!line) {
        throw new Error(`Linha não encontrada para item ${ingredient.itemId} na variação ${itemVariationId}`);
      }

      await updateRecipeCompositionLine({
        db,
        lineId: line.id,
        recipeId: recipe.id,
        unit: ingredient.unit,
        quantity,
        lossPct: ingredient.defaultLossPct,
      });
    }
  }

  const itemCostSheetId = await ensureItemCostSheetForRecipe({ db, item, recipe });

  return {
    recipeId: recipe.id,
    itemCostSheetId,
  };
}
