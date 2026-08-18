import { Recipe, RecipeType } from "@prisma/client";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Form,
  Link,
  Outlet,
  useActionData,
  useFetcher,
  useLoaderData,
  useLocation,
  useSearchParams,
} from "@remix-run/react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "~/components/ui/use-toast";
import { DecimalInput } from "~/components/inputs/inputs";
import { notifyRecipeCostSheetRecalculationRequired } from "~/domain/recipe/recipe-cost-sheet-recalculation-notification.server";
import { getAvailableItemUnits } from "~/domain/item/item-units.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import { ensureItemCostSheetForRecipe } from "~/domain/recipe/recipe-item-cost-sheet.server";
import { countRecipeCostSheetUsage } from "~/domain/recipe/recipe-cost-sheet-usage.server";
import { countParentRecipes } from "~/domain/recipe/recipe-links.server";
import {
  DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
  RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
  RECIPE_CHATGPT_SETTINGS_CONTEXT,
} from "~/domain/recipe/recipe-chatgpt-settings";
import {
  buildExternalRecipeChatGptImportPreview,
  importExternalRecipeFromChatGpt,
  parseExternalRecipeChatGptImportPayload,
  type ExternalRecipeImportMode,
} from "~/domain/recipe/recipe-external-chatgpt.server";
import {
  applyRecipeCompositionLineToVariations,
  createRecipeCompositionIngredientSkeleton,
  deleteRecipeCompositionLine,
  listRecipeLinkedVariations,
  listRecipeCompositionLines,
  moveRecipeCompositionIngredient,
  reorderRecipeCompositionIngredients,
  updateRecipeCompositionIngredientDefaultLoss,
  updateRecipeCompositionLine,
} from "~/domain/recipe/recipe-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

function parseLossPctInput(value: unknown): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function parseDecimalInput(value: unknown): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseExternalRecipeExcludedIngredientIndexes(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Set<number>();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(
      parsed
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry >= 0)
    );
  } catch (_error) {
    return new Set<number>();
  }
}

function filterExternalRecipePayloadIngredients<
  T extends ReturnType<typeof parseExternalRecipeChatGptImportPayload>
>(payload: T, excludedIngredientIndexes: Set<number>): T {
  if (excludedIngredientIndexes.size === 0) return payload;
  return {
    ...payload,
    ingredients: payload.ingredients.filter(
      (ingredient) => !excludedIngredientIndexes.has(ingredient.sourceIndex)
    ),
  };
}

function normalizeRecipeUnit(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function convertRecipeQuantityUnit(params: {
  quantity: number;
  fromUnit: string;
  toUnit: string;
}) {
  const fromUnit = normalizeRecipeUnit(params.fromUnit);
  const toUnit = normalizeRecipeUnit(params.toUnit);
  if (!fromUnit || !toUnit || fromUnit === toUnit) return params.quantity;

  if (fromUnit === "G" && toUnit === "KG") return params.quantity / 1000;
  if (fromUnit === "KG" && toUnit === "G") return params.quantity * 1000;
  if (fromUnit === "ML" && toUnit === "L") return params.quantity / 1000;
  if (fromUnit === "L" && toUnit === "ML") return params.quantity * 1000;

  return params.quantity;
}

function parseMissingIngredientQuantity(missingIngredient: {
  unit: string | null;
  notes: string | null;
}) {
  const notes = String(missingIngredient.notes || "");
  const match = notes.match(/(\d+(?:[,.]\d+)?)\s*(kg|g|l|ml|un)\b/i);
  if (!match) return null;

  const quantity = parseDecimalInput(match[1]);
  const sourceUnit = normalizeRecipeUnit(match[2]);
  const targetUnit = normalizeRecipeUnit(missingIngredient.unit || sourceUnit);
  if (quantity === null || Number.isNaN(quantity) || quantity < 0) return null;

  return {
    quantity: convertRecipeQuantityUnit({
      quantity,
      fromUnit: sourceUnit,
      toUnit: targetUnit,
    }),
    unit: targetUnit || sourceUnit || "UN",
  };
}

async function promoteExternalMissingIngredientsToCreateRows(params: {
  db: any;
  recipeId: string;
  payload: ReturnType<typeof parseExternalRecipeChatGptImportPayload>;
}) {
  const linkedVariations = await listRecipeLinkedVariations(
    params.db,
    params.recipeId
  );
  const linkedVariationIds = linkedVariations
    .map((variation) => String(variation.itemVariationId || ""))
    .filter(Boolean);
  if (linkedVariationIds.length === 0) return params.payload;

  const promotedIngredients: typeof params.payload.ingredients = [];
  const remainingMissingIngredients: typeof params.payload.missingIngredients =
    [];
  const sourceIndexOffset = 100000;

  params.payload.missingIngredients.forEach((missingIngredient, index) => {
    const parsedQuantity = parseMissingIngredientQuantity(missingIngredient);
    if (!parsedQuantity) {
      remainingMissingIngredients.push(missingIngredient);
      return;
    }

    promotedIngredients.push({
      sourceIndex: sourceIndexOffset + index,
      itemId: null,
      itemName: missingIngredient.name,
      classification: "insumo",
      unit: parsedQuantity.unit,
      defaultLossPct: 0,
      variationQuantities: Object.fromEntries(
        linkedVariationIds.map((variationId) => [
          variationId,
          parsedQuantity.quantity,
        ])
      ),
    });
  });

  if (promotedIngredients.length === 0) return params.payload;

  return {
    ...params.payload,
    ingredients: [...params.payload.ingredients, ...promotedIngredients],
    missingIngredients: remainingMissingIngredients,
  };
}

function parseRecipeCostingInput(values: Record<string, FormDataEntryValue>) {
  const costingModeRaw = String(values.costingMode || "per_variation").trim();
  const costingMode = costingModeRaw === "yield" ? "yield" : "per_variation";
  const yieldQuantity = parseDecimalInput(values.yieldQuantity);
  const yieldUnit = String(values.yieldUnit || "")
    .trim()
    .toUpperCase();

  if (costingMode === "yield") {
    if (
      yieldQuantity === null ||
      Number.isNaN(yieldQuantity) ||
      yieldQuantity <= 0
    ) {
      throw new Error("Informe quanto a receita produz");
    }
    if (!yieldUnit) {
      throw new Error("Informe a unidade do rendimento");
    }
  }

  return {
    costingMode,
    yieldQuantity: costingMode === "yield" ? yieldQuantity : null,
    yieldUnit: costingMode === "yield" ? yieldUnit : null,
  };
}

function extractJsonPayloadFromText(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBraceIndex = raw.indexOf("{");
  const lastBraceIndex = raw.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return raw;
}

type RecipeChatGptImportIngredient = {
  itemId?: unknown;
  itemName?: unknown;
  action?: unknown;
  operation?: unknown;
  unit?: unknown;
  defaultLossPct?: unknown;
  variationQuantities?: Record<string, unknown> | null;
};

type RecipeChatGptImportPayload = {
  recipeId?: unknown;
  ingredients?: RecipeChatGptImportIngredient[];
  missingIngredients?: Array<{
    name?: unknown;
    unit?: unknown;
    notes?: unknown;
  }>;
};

function parseRecipeChatGptImportPayload(value: string): {
  recipeId: string | null;
  ingredients: Array<{
    itemId: string;
    action: "upsert" | "delete";
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

  let parsed: RecipeChatGptImportPayload;
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

  const seenItemIds = new Set<string>();
  const ingredients = ingredientsRaw.map((ingredient, index) => {
    const itemId = String(ingredient?.itemId || "").trim();
    const actionRaw = String(
      ingredient?.action || ingredient?.operation || "upsert"
    )
      .trim()
      .toLowerCase();
    const action = ["delete", "remove", "remover", "eliminar"].includes(
      actionRaw
    )
      ? "delete"
      : "upsert";
    const unit = String(ingredient?.unit || "")
      .trim()
      .toUpperCase();
    const defaultLossPctParsed = parseDecimalInput(ingredient?.defaultLossPct);
    const variationEntries = Object.entries(
      ingredient?.variationQuantities || {}
    );

    if (!itemId) {
      throw new Error(`Ingrediente ${index + 1}: itemId é obrigatório`);
    }
    if (seenItemIds.has(itemId)) {
      throw new Error(`Ingrediente ${index + 1}: itemId duplicado (${itemId})`);
    }
    seenItemIds.add(itemId);
    if (action === "delete") {
      return {
        itemId,
        action,
        unit: unit || "UN",
        defaultLossPct:
          defaultLossPctParsed == null || Number.isNaN(defaultLossPctParsed)
            ? 0
            : defaultLossPctParsed,
        variationQuantities: {},
      };
    }
    if (!unit) {
      throw new Error(`Ingrediente ${index + 1}: unit é obrigatório`);
    }
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
      itemId,
      action,
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

    if (!name) {
      throw new Error(`Ingrediente faltante ${index + 1}: name é obrigatório`);
    }

    return {
      name,
      unit: unitRaw || null,
      notes: notes || null,
    };
  });

  return {
    recipeId: String(parsed?.recipeId || "").trim() || null,
    ingredients,
    missingIngredients,
  };
}

async function buildRecipeChatGptImportPreview(params: {
  db: any;
  recipeId: string;
  payload: ReturnType<typeof parseRecipeChatGptImportPayload>;
}) {
  const { db, recipeId, payload } = params;
  const [linkedVariations, itemCatalog, currentLines] = await Promise.all([
    listRecipeLinkedVariations(db, recipeId),
    db.item.findMany({
      where: {
        id: { in: payload.ingredients.map((ingredient) => ingredient.itemId) },
      },
      select: { id: true, name: true, consumptionUm: true },
    }),
    listRecipeCompositionLines(db, recipeId),
  ]);

  const itemById = new Map<
    string,
    { id: string; name: string; consumptionUm?: string | null }
  >(
    itemCatalog.map(
      (item: { id: string; name: string; consumptionUm?: string | null }) => [
        item.id,
        item,
      ]
    )
  );
  const linkedVariationIds = new Set(
    linkedVariations.map((variation) => variation.itemVariationId)
  );
  const variationNameById = new Map(
    linkedVariations.map((variation) => [
      variation.itemVariationId,
      variation.variationName || "Base",
    ])
  );
  const currentLinesByItemId = currentLines.reduce((acc, line) => {
    const itemId = String(line.itemId || "");
    if (!itemId) return acc;
    const lines = acc.get(itemId) || [];
    lines.push(line);
    acc.set(itemId, lines);
    return acc;
  }, new Map<string, any[]>());

  const importableIngredients = payload.ingredients.map((ingredient) => {
    const item = itemById.get(ingredient.itemId);
    if (!item) {
      throw new Error(
        `Ingrediente não encontrado para itemId ${ingredient.itemId}`
      );
    }

    const currentItemLines = currentLinesByItemId.get(ingredient.itemId) || [];
    if (ingredient.action === "delete" && currentItemLines.length === 0) {
      throw new Error(
        `Ingrediente marcado para eliminar não está na composição atual: ${item.name}`
      );
    }

    const variationKeysRaw = Object.keys(ingredient.variationQuantities);
    const variationKeys =
      ingredient.action === "delete" && variationKeysRaw.length === 0
        ? currentItemLines
            .map((line) => String(line.ItemVariation?.id || ""))
            .filter(Boolean)
        : variationKeysRaw;
    const invalidVariationId = variationKeys.find(
      (variationId) => !linkedVariationIds.has(variationId)
    );
    if (invalidVariationId) {
      throw new Error(`Variação inválida no JSON: ${invalidVariationId}`);
    }

    const firstCurrentLine = currentItemLines[0];

    return {
      itemId: ingredient.itemId,
      itemName: item.name,
      action: ingredient.action,
      previewAction:
        ingredient.action === "delete"
          ? "delete"
          : currentItemLines.length > 0
          ? "update"
          : "add",
      unit:
        ingredient.action === "delete"
          ? String(
              firstCurrentLine?.unit ||
                ingredient.unit ||
                item.consumptionUm ||
                "UN"
            )
              .trim()
              .toUpperCase()
          : ingredient.unit,
      defaultLossPct:
        ingredient.action === "delete"
          ? Number(
              firstCurrentLine?.defaultLossPct || ingredient.defaultLossPct || 0
            )
          : ingredient.defaultLossPct,
      variationCount: variationKeys.length,
      zeroQtyVariationCount: variationKeys.filter(
        (variationId) =>
          Number(ingredient.variationQuantities[variationId] || 0) <= 0
      ).length,
      variations: variationKeys.map((variationId) => ({
        itemVariationId: variationId,
        variationName: String(variationNameById.get(variationId) || "Variação"),
        quantity:
          ingredient.action === "delete" && variationKeysRaw.length === 0
            ? Number(
                currentItemLines.find(
                  (line) => String(line.ItemVariation?.id || "") === variationId
                )?.quantity || 0
              )
            : Number(ingredient.variationQuantities[variationId] || 0),
      })),
    };
  });

  return {
    itemById,
    linkedVariations,
    linkedVariationIds,
    preview: {
      importableIngredients,
      missingIngredients: payload.missingIngredients,
      totals: {
        importableIngredients: importableIngredients.length,
        missingIngredients: payload.missingIngredients.length,
        variationCells: importableIngredients.reduce(
          (acc, ingredient) => acc + ingredient.variationCount,
          0
        ),
      },
    },
  };
}

export const RECIPE_SECTIONS = [
  "cadastro",
  "procedimento",
  "composicao",
  "variacoes",
  "fichas",
  "receitas",
] as const;
export type RecipeSection = (typeof RECIPE_SECTIONS)[number];
export const ALPHABET_FILTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function resolveRecipeSection(value: unknown): RecipeSection {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return RECIPE_SECTIONS.includes(normalized as RecipeSection)
    ? (normalized as RecipeSection)
    : "cadastro";
}

export function buildRecipeSectionHref(
  recipeId: string,
  section: RecipeSection
) {
  if (section === "cadastro") return `/admin/recipes/${recipeId}`;
  if (section === "procedimento") {
    return `/admin/recipes/${recipeId}/procedimento/editar`;
  }
  return `/admin/recipes/${recipeId}/${section}`;
}

function buildRecipeSectionRedirect(recipeId: string, sectionRaw: unknown) {
  return redirect(
    buildRecipeSectionHref(recipeId, resolveRecipeSection(sectionRaw))
  );
}

async function buildRecipeCostSheetRecalculationRedirect(
  recipeId: string,
  sectionRaw: unknown
) {
  await notifyRecipeCostSheetRecalculationRequired(
    prismaClient as any,
    recipeId
  );
  const href = buildRecipeSectionHref(
    recipeId,
    resolveRecipeSection(sectionRaw)
  );
  return redirect(`${href}?recalculateCostSheet=yes`);
}

function buildRecipeCostSheetCreatedHref(
  recipeId: string,
  sectionRaw: unknown,
  itemCostSheetId: string
) {
  const href = buildRecipeSectionHref(
    recipeId,
    resolveRecipeSection(sectionRaw)
  );
  const params = new URLSearchParams({
    createdCostSheetId: itemCostSheetId,
  });

  return `${href}?${params.toString()}`;
}

function buildRecipeLinkedItemCreatedHref(params: {
  recipeId: string;
  section?: RecipeSection;
  itemId: string;
  unit?: string | null;
}) {
  const href = buildRecipeSectionHref(
    params.recipeId,
    params.section || "cadastro"
  );
  const searchParams = new URLSearchParams({
    linkedItemCreatedId: params.itemId,
  });
  const unit = String(params.unit || "")
    .trim()
    .toUpperCase();
  if (unit) searchParams.set("linkedItemUnit", unit);
  return `${href}?${searchParams.toString()}`;
}

function formatRecipeQuantity(value: unknown, fractionDigits = 3) {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return "";
  return quantity.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

async function ensureRecipeLinkedItem(db: any, recipe: Recipe) {
  const linkedItemId = String((recipe as any)?.itemId || "").trim();
  const recipeYieldUnit =
    String((recipe as any)?.costingMode || "") === "yield"
      ? String((recipe as any)?.yieldUnit || "")
          .trim()
          .toUpperCase()
      : "";

  if (linkedItemId) {
    const item = await db.item.findUnique({
      where: { id: linkedItemId },
      select: { id: true, name: true, consumptionUm: true },
    });
    if (item) {
      if (recipeYieldUnit && !item.consumptionUm) {
        return await db.item.update({
          where: { id: item.id },
          data: { consumptionUm: recipeYieldUnit },
          select: { id: true, name: true, consumptionUm: true },
        });
      }
      return item;
    }
  }

  let item = await db.item.findFirst({
    where: { name: recipe.name },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, consumptionUm: true },
  });

  if (!item) {
    const isSemiFinished = recipe.type === "semiFinished";
    item = await db.item.create({
      data: {
        name: recipe.name,
        description: recipe.description || null,
        classification: isSemiFinished ? "semi_acabado" : "produto_final",
        active: true,
        canPurchase: false,
        canTransform: true,
        canSell: !isSemiFinished,
        canStock: true,
        consumptionUm: recipeYieldUnit || null,
      },
      select: { id: true, name: true, consumptionUm: true },
    });
  } else if (recipeYieldUnit && !item.consumptionUm) {
    item = await db.item.update({
      where: { id: item.id },
      data: { consumptionUm: recipeYieldUnit },
      select: { id: true, name: true, consumptionUm: true },
    });
  }

  await db.recipe.update({
    where: { id: recipe.id },
    data: {
      itemId: item.id,
      variationId: null,
    },
  });

  return item;
}

export function normalizeInitialLetter(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .charAt(0)
    .toUpperCase();
}

export async function loader({ params }: LoaderFunctionArgs) {
  const recipeId = params?.id;

  if (!recipeId) {
    return null;
  }

  const recipe = await recipeEntity.findById(recipeId);

  if (!recipe) {
    return badRequest({ message: "Receita não encontrado" });
  }

  try {
    const db = prismaClient as any;
    const items = await db.item.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        classification: true,
        consumptionUm: true,
      },
      orderBy: [{ name: "asc" }],
      take: 500,
    });
    const [
      recipeLines,
      linkedVariations,
      unitOptions,
      chatGptProjectUrlSetting,
      recipeCostSheetCount,
      recipeLinksCount,
    ] = await Promise.all([
      listRecipeCompositionLines(db, recipeId),
      listRecipeLinkedVariations(db, recipeId),
      getAvailableItemUnits(),
      db.setting.findFirst({
        where: {
          context: RECIPE_CHATGPT_SETTINGS_CONTEXT,
          name: RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
        },
        orderBy: [{ createdAt: "desc" }],
        select: { value: true },
      }),
      countRecipeCostSheetUsage(db, recipeId),
      countParentRecipes(db, String((recipe as any)?.itemId || "") || null),
    ]);

    return ok({
      recipe,
      items,
      recipeLines,
      linkedVariations,
      unitOptions,
      recipeCostSheetCount,
      recipeLinksCount,
      chatGptProjectUrl:
        String(chatGptProjectUrlSetting?.value || "").trim() ||
        DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
    });
  } catch (error) {
    return badRequest(
      (error as Error)?.message || "Erro ao carregar catálogos"
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);
  const currentSection = resolveRecipeSection(values.tab);

  if (_action === "recipe-delete") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    try {
      await recipeEntity.delete(recipeId);
      return redirect("/admin/recipes");
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao eliminar receita"
      );
    }
  }

  if (_action === "recipe-duplicate") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    try {
      const duplicatedRecipe = await recipeEntity.duplicate(recipeId);
      return redirect(buildRecipeSectionHref(duplicatedRecipe.id, "cadastro"));
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao duplicar receita"
      );
    }
  }

  if (_action === "recipe-create-cost-sheet") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    try {
      const db = prismaClient as any;
      const recipe = await recipeEntity.findById(recipeId);
      if (!recipe) return badRequest("Receita não encontrada");

      const item = await ensureRecipeLinkedItem(db, recipe);
      const { rootSheetId } = await ensureItemCostSheetForRecipe({
        db,
        item,
        recipe: {
          id: recipe.id,
          name: recipe.name,
        },
        sheetDescription: `Ficha tecnica gerada a partir da receita ${recipe.name}`,
        componentNotes:
          "Componente criado automaticamente a partir da receita aberta",
      });

      return redirect(
        buildRecipeCostSheetCreatedHref(recipeId, currentSection, rootSheetId)
      );
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao criar ficha técnica"
      );
    }
  }

  if (_action === "recipe-ingredient-add") {
    const recipeId = String(values.recipeId || "").trim();
    const itemId = String(values.lineItemId || "").trim();

    if (!recipeId) return badRequest("Receita inválida");
    if (!itemId) return badRequest("Selecione um ingrediente");

    try {
      const db = prismaClient as any;
      const item = await db.item.findUnique({
        where: { id: itemId },
        select: { consumptionUm: true },
      });
      const defaultUnit =
        String(item?.consumptionUm || "UN")
          .trim()
          .toUpperCase() || "UN";
      await createRecipeCompositionIngredientSkeleton({
        db,
        recipeId,
        itemId,
        defaultUnit,
      });

      return buildRecipeCostSheetRecalculationRedirect(
        recipeId,
        currentSection
      );
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao adicionar ingrediente"
      );
    }
  }

  if (_action === "recipe-ingredient-batch-add") {
    const recipeId = String(values.recipeId || "").trim();
    const targetItemIdsRaw = String(values.targetItemIds || "").trim();
    const targetItemIds = targetItemIdsRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!recipeId) return badRequest("Receita inválida");
    if (targetItemIds.length === 0)
      return badRequest("Selecione ao menos um ingrediente");

    try {
      const db = prismaClient as any;
      for (const itemId of targetItemIds) {
        const item = await db.item.findUnique({
          where: { id: itemId },
          select: { consumptionUm: true },
        });
        const defaultUnit =
          String(item?.consumptionUm || "UN")
            .trim()
            .toUpperCase() || "UN";
        await createRecipeCompositionIngredientSkeleton({
          db,
          recipeId,
          itemId,
          defaultUnit,
        });
      }
      return buildRecipeCostSheetRecalculationRedirect(
        recipeId,
        currentSection
      );
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao adicionar ingredientes"
      );
    }
  }

  if (_action === "recipe-chatgpt-import") {
    const recipeId = String(values.recipeId || "").trim();
    const chatGptResponse = String(values.chatGptResponse || "").trim();
    const ignoredDeleteItemIdsRaw = String(
      values.ignoredDeleteItemIds || ""
    ).trim();
    const manualDeleteItemIdsRaw = String(
      values.manualDeleteItemIds || ""
    ).trim();

    if (!recipeId) return badRequest("Receita inválida");
    if (!chatGptResponse)
      return badRequest("Cole a resposta do ChatGPT antes de importar");

    try {
      const payload = parseRecipeChatGptImportPayload(chatGptResponse);
      if (payload.recipeId && payload.recipeId !== recipeId) {
        return badRequest("O recipeId do JSON não corresponde à receita atual");
      }
      if (payload.ingredients.length === 0) {
        return badRequest(
          "A resposta só contém ingredientes faltantes. Cadastre os itens e tente novamente."
        );
      }
      let ignoredDeleteItemIds: string[] = [];
      if (ignoredDeleteItemIdsRaw) {
        try {
          const parsedIgnored = JSON.parse(ignoredDeleteItemIdsRaw);
          ignoredDeleteItemIds = Array.isArray(parsedIgnored)
            ? parsedIgnored
                .map((itemId) => String(itemId || "").trim())
                .filter(Boolean)
            : [];
        } catch (_error) {
          ignoredDeleteItemIds = [];
        }
      }
      const ignoredDeleteSet = new Set(ignoredDeleteItemIds);

      let manualDeleteItemIds: string[] = [];
      if (manualDeleteItemIdsRaw) {
        try {
          const parsedManual = JSON.parse(manualDeleteItemIdsRaw);
          manualDeleteItemIds = Array.isArray(parsedManual)
            ? parsedManual.map((id) => String(id || "").trim()).filter(Boolean)
            : [];
        } catch (_error) {
          manualDeleteItemIds = [];
        }
      }
      const manualDeleteSet = new Set(manualDeleteItemIds);

      const db = prismaClient as any;
      const { itemById } = await buildRecipeChatGptImportPreview({
        db,
        recipeId,
        payload,
      });
      const aiDeleteItemIds = payload.ingredients
        .filter(
          (ingredient) =>
            ingredient.action === "delete" &&
            !ignoredDeleteSet.has(ingredient.itemId)
        )
        .map((ingredient) => ingredient.itemId);
      const allDeleteItemIds = [
        ...new Set([...aiDeleteItemIds, ...manualDeleteItemIds]),
      ];

      if (allDeleteItemIds.length > 0) {
        const currentLines = await listRecipeCompositionLines(db, recipeId);
        const linesToDelete = currentLines.filter((line) =>
          allDeleteItemIds.includes(String(line.itemId || ""))
        );
        for (const line of linesToDelete) {
          await deleteRecipeCompositionLine(db, String(line.id));
        }
      }

      for (const ingredient of payload.ingredients.filter(
        (ingredient) =>
          ingredient.action !== "delete" &&
          !manualDeleteSet.has(ingredient.itemId)
      )) {
        const item = itemById.get(ingredient.itemId);
        const defaultUnit =
          String(ingredient.unit || item.consumptionUm || "UN")
            .trim()
            .toUpperCase() || "UN";
        await createRecipeCompositionIngredientSkeleton({
          db,
          recipeId,
          itemId: ingredient.itemId,
          defaultUnit,
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
          lineByItemAndVariation.set(
            `${line.itemId}::${itemVariationId}`,
            line
          );
        }
      }

      for (const ingredient of payload.ingredients.filter(
        (ingredient) =>
          ingredient.action !== "delete" &&
          !manualDeleteSet.has(ingredient.itemId)
      )) {
        const recipeIngredientId = ingredientByItemId.get(ingredient.itemId);
        if (!recipeIngredientId) {
          return badRequest(
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
            return badRequest(
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

      return buildRecipeCostSheetRecalculationRedirect(recipeId, "variacoes");
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao importar composição do ChatGPT"
      );
    }
  }

  if (_action === "recipe-chatgpt-preview") {
    const recipeId = String(values.recipeId || "").trim();
    const chatGptResponse = String(values.chatGptResponse || "").trim();

    if (!recipeId) return badRequest("Receita inválida");
    if (!chatGptResponse)
      return badRequest("Cole a resposta do ChatGPT antes de pré-visualizar");

    try {
      const payload = parseRecipeChatGptImportPayload(chatGptResponse);
      if (payload.recipeId && payload.recipeId !== recipeId) {
        return badRequest("O recipeId do JSON não corresponde à receita atual");
      }

      const db = prismaClient as any;
      const { preview } = await buildRecipeChatGptImportPreview({
        db,
        recipeId,
        payload,
      });

      return ok({
        message: "Pré-visualização gerada",
        payload: preview,
      });
    } catch (error) {
      return badRequest(
        (error as Error)?.message ||
          "Erro ao gerar pré-visualização da importação"
      );
    }
  }

  if (_action === "external-recipe-chatgpt-preview") {
    const recipeId = String(values.recipeId || "").trim();
    const chatGptResponse = String(values.chatGptResponse || "").trim();
    const importMode = String(
      values.externalRecipeImportMode || "replace_current"
    ).trim() as ExternalRecipeImportMode;
    const excludedIngredientIndexes =
      parseExternalRecipeExcludedIngredientIndexes(
        values.externalRecipeExcludedIngredientIndexes
      );

    if (!recipeId) return badRequest("Receita inválida");
    if (!chatGptResponse)
      return badRequest("Cole a resposta do ChatGPT antes de pré-visualizar");

    try {
      const db = prismaClient as any;
      const payload = filterExternalRecipePayloadIngredients(
        await promoteExternalMissingIngredientsToCreateRows({
          db,
          recipeId,
          payload: parseExternalRecipeChatGptImportPayload(chatGptResponse),
        }),
        excludedIngredientIndexes
      );
      if (payload.ingredients.length === 0) {
        return badRequest(
          "A resposta só contém ingredientes pendentes. Ajuste o JSON ou cadastre os itens antes de importar."
        );
      }

      const { preview } = await buildExternalRecipeChatGptImportPreview({
        db,
        recipeId,
        payload,
        importMode,
      });

      return ok({
        message: "Pré-visualização gerada",
        payload: preview,
      });
    } catch (error) {
      return badRequest(
        (error as Error)?.message ||
          "Erro ao gerar pré-visualização da receita externa"
      );
    }
  }

  if (_action === "external-recipe-chatgpt-import") {
    const recipeId = String(values.recipeId || "").trim();
    const chatGptResponse = String(values.chatGptResponse || "").trim();
    const importMode = String(
      values.externalRecipeImportMode || "replace_current"
    ).trim() as ExternalRecipeImportMode;
    const excludedIngredientIndexes =
      parseExternalRecipeExcludedIngredientIndexes(
        values.externalRecipeExcludedIngredientIndexes
      );

    if (!recipeId) return badRequest("Receita inválida");
    if (!chatGptResponse)
      return badRequest("Cole a resposta do ChatGPT antes de importar");

    try {
      const db = prismaClient as any;
      const payload = filterExternalRecipePayloadIngredients(
        await promoteExternalMissingIngredientsToCreateRows({
          db,
          recipeId,
          payload: parseExternalRecipeChatGptImportPayload(chatGptResponse),
        }),
        excludedIngredientIndexes
      );
      if (payload.ingredients.length === 0) {
        return badRequest(
          "A resposta só contém ingredientes pendentes. Ajuste o JSON ou cadastre os itens antes de importar."
        );
      }

      await importExternalRecipeFromChatGpt({
        db,
        recipeId,
        payload,
        importMode,
      });

      return buildRecipeCostSheetRecalculationRedirect(recipeId, "variacoes");
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao importar receita externa"
      );
    }
  }

  if (_action === "recipe-line-delete") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeLineId = String(values.recipeLineId || "").trim();
    if (!recipeId || !recipeLineId) return badRequest("Linha inválida");

    try {
      const db = prismaClient as any;
      await deleteRecipeCompositionLine(db, recipeLineId);
      return buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao remover item da composição"
      );
    }
  }

  if (_action === "recipe-ingredient-delete") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeIngredientId = String(values.recipeIngredientId || "").trim();
    const recipeLineId = String(values.recipeLineId || "").trim();
    if (!recipeId) return badRequest("Linha inválida");

    try {
      const db = prismaClient as any;
      if (
        recipeIngredientId &&
        typeof db?.recipeVariationIngredient?.findMany === "function"
      ) {
        const lines = await db.recipeVariationIngredient.findMany({
          where: { recipeIngredientId },
          select: { id: true },
        });
        for (const line of lines) {
          await deleteRecipeCompositionLine(db, String(line.id));
        }
        return buildRecipeCostSheetRecalculationRedirect(
          recipeId,
          currentSection
        );
      }
      if (recipeLineId) {
        await deleteRecipeCompositionLine(db, recipeLineId);
        return buildRecipeCostSheetRecalculationRedirect(
          recipeId,
          currentSection
        );
      }
      return badRequest("Linha inválida");
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao remover ingrediente da composição"
      );
    }
  }

  if (_action === "recipe-ingredient-move") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeIngredientId = String(values.recipeIngredientId || "").trim();
    const recipeLineId = String(values.recipeLineId || "").trim();
    const direction = String(values.direction || "")
      .trim()
      .toLowerCase();

    if (!recipeId) return badRequest("Ingrediente inválido");
    if (!["up", "down"].includes(direction))
      return badRequest("Direção inválida");

    try {
      const db = prismaClient as any;
      await moveRecipeCompositionIngredient({
        db,
        recipeId,
        recipeIngredientId,
        recipeLineId,
        direction: direction as "up" | "down",
      });
      return buildRecipeSectionRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message ||
          "Erro ao reordenar ingrediente da composição"
      );
    }
  }

  if (_action === "recipe-ingredient-reorder") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    try {
      const orderedIds = JSON.parse(String(values.orderedIds || "[]"));
      if (!Array.isArray(orderedIds)) return badRequest("Ordem inválida");

      await reorderRecipeCompositionIngredients({
        db: prismaClient as any,
        recipeId,
        orderedIds,
      });
      return ok({ reordered: true });
    } catch (error) {
      return badRequest(
        (error as Error)?.message ||
          "Erro ao reordenar ingredientes da composição"
      );
    }
  }

  if (_action === "recipe-line-update") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeLineId = String(values.recipeLineId || "").trim();
    const unit = String(values.lineUnit || "")
      .trim()
      .toUpperCase();
    const quantity = Number(
      String(values.lineQuantity || "0").replace(",", ".")
    );

    if (!recipeId || !recipeLineId) return badRequest("Linha inválida");
    if (!unit) return badRequest("Informe a unidade de consumo");
    if (!Number.isFinite(quantity) || quantity <= 0)
      return badRequest("Informe uma quantidade válida");

    try {
      const db = prismaClient as any;
      const lines = await listRecipeCompositionLines(db, recipeId);
      const line = lines.find((current) => current.id === recipeLineId);
      if (!line) {
        return badRequest("Linha da receita não encontrada");
      }

      await updateRecipeCompositionLine({
        db,
        lineId: recipeLineId,
        recipeId,
        unit,
        quantity,
        lossPct: null,
      });

      return buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao atualizar item da composição"
      );
    }
  }

  if (_action === "recipe-line-apply-variations") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeLineId = String(values.recipeLineId || "").trim();
    const formVariationIds = formData
      .getAll("variationId")
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const variationIdsRaw = String(values.targetVariationIds || "").trim();
    const variationIds =
      formVariationIds.length > 0
        ? formVariationIds
        : variationIdsRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

    if (!recipeId || !recipeLineId) return badRequest("Linha inválida");
    if (variationIds.length === 0)
      return badRequest("Selecione ao menos uma variação");

    try {
      const db = prismaClient as any;
      await applyRecipeCompositionLineToVariations({
        db,
        recipeId,
        lineId: recipeLineId,
        variationIds,
      });

      return buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message ||
          "Erro ao aplicar para variações selecionadas"
      );
    }
  }

  if (_action === "recipe-ingredient-unit-update") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeIngredientId = String(values.recipeIngredientId || "").trim();
    const unit = String(values.lineUnit || "")
      .trim()
      .toUpperCase();
    if (!recipeId || !recipeIngredientId)
      return badRequest("Ingrediente inválido");
    if (!unit) return badRequest("Informe a UM");

    try {
      const db = prismaClient as any;
      const lines = await listRecipeCompositionLines(db, recipeId);
      const targetLines = lines.filter(
        (line) => String(line.recipeIngredientId || "") === recipeIngredientId
      );
      for (const line of targetLines) {
        await updateRecipeCompositionLine({
          db,
          lineId: line.id,
          recipeId,
          unit,
          quantity: Number(line.quantity || 0),
          lossPct: null,
        });
      }
      return buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao atualizar UM do ingrediente"
      );
    }
  }

  if (_action === "recipe-ingredient-loss-update") {
    const recipeId = String(values.recipeId || "").trim();
    const recipeIngredientId = String(values.recipeIngredientId || "").trim();
    const requestedLossPct = parseLossPctInput(values.defaultLossPct);
    const applyToLines =
      String(values.applyToLines || "")
        .trim()
        .toLowerCase() === "yes";
    if (!recipeId || !recipeIngredientId)
      return badRequest("Ingrediente inválido");
    if (requestedLossPct === null || Number.isNaN(requestedLossPct))
      return badRequest("Perda padrão inválida");
    if (requestedLossPct < 0 || requestedLossPct >= 100)
      return badRequest("Perda deve ser entre 0 e 99,9999");

    try {
      const db = prismaClient as any;
      await updateRecipeCompositionIngredientDefaultLoss({
        db,
        recipeId,
        recipeIngredientId,
        defaultLossPct: requestedLossPct,
        applyToVariationLines: applyToLines,
      });

      const lines = await listRecipeCompositionLines(db, recipeId);
      const targetLines = lines.filter(
        (line) => String(line.recipeIngredientId || "") === recipeIngredientId
      );
      for (const line of targetLines) {
        const effectiveLossPct = applyToLines
          ? requestedLossPct
          : Number(line.lossPct ?? requestedLossPct);
        await updateRecipeCompositionLine({
          db,
          lineId: line.id,
          recipeId,
          unit: line.unit,
          quantity: Number(line.quantity || 0),
          lossPct: applyToLines ? effectiveLossPct : line.lossPct,
        });
      }

      return buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection);
    } catch (error) {
      return badRequest(
        (error as Error)?.message || "Erro ao atualizar perda padrão"
      );
    }
  }

  if (_action === "recipe-update") {
    const recipe = await recipeEntity.findById(values?.recipeId as string);
    const requestedItemIdRaw = String(values.linkedItemId || "").trim();
    const currentItemId = String((recipe as any)?.itemId || "").trim();
    const isItemChangeRequested = requestedItemIdRaw !== currentItemId;
    const confirmItemRemap =
      String(values.confirmItemRemap || "")
        .trim()
        .toLowerCase() === "yes";

    if (isItemChangeRequested && !confirmItemRemap) {
      return badRequest(
        "Troca de item requer confirmação: os dados por variação serão apagados e será necessário remapeamento."
      );
    }

    let costingInput: ReturnType<typeof parseRecipeCostingInput>;
    try {
      costingInput = parseRecipeCostingInput(values);
    } catch (error) {
      return badRequest((error as Error)?.message || "Rendimento inválido");
    }
    const costingModeChanged =
      String((recipe as any)?.costingMode || "") !==
      String(costingInput.costingMode || "");
    const costingChanged =
      costingModeChanged ||
      Number((recipe as any)?.yieldQuantity || 0) !==
        Number(costingInput.yieldQuantity || 0) ||
      String((recipe as any)?.yieldUnit || "")
        .trim()
        .toUpperCase() !==
        String(costingInput.yieldUnit || "").trim().toUpperCase();

    const costingModeChangeConfirmed =
      String(values.confirmCostingModeChange || "")
        .trim()
        .toLowerCase() === "yes";
    if (costingModeChanged && !costingModeChangeConfirmed) {
      return badRequest(
        "Confirme a mudança do modo da receita e seus impactos antes de salvar."
      );
    }

    const nextRecipe = {
      name: values.name as string,
      type: values.type as RecipeType,
      costingMode: costingInput.costingMode,
      yieldQuantity: costingInput.yieldQuantity,
      yieldUnit: costingInput.yieldUnit,
      description: (values?.description as string) || "",
      hasVariations: false,
      isGlutenFree: values.isGlutenFree === "on" ? true : false,
      isVegetarian: values.isVegetarian === "on" ? true : false,
    };

    const [err] = await prismaIt(
      recipeEntity.update(values.recipeId as string, nextRecipe)
    );

    if (err) {
      return badRequest(err);
    }

    let ensuredItem: any = null;
    let linkedItemWasCreated = false;

    try {
      const db = prismaClient as any;
      const explicitItemId = String(values.linkedItemId || "").trim();
      const updatedRecipe = await db.recipe.findUnique({
        where: { id: values.recipeId as string },
        select: {
          id: true,
          itemId: true,
          name: true,
          description: true,
          type: true,
          costingMode: true,
          yieldUnit: true,
        },
      });

      if (updatedRecipe) {
        const previousItemId = updatedRecipe.itemId as string | null;
        let itemId = previousItemId;
        const recipeYieldUnit =
          String(updatedRecipe.costingMode || "") === "yield"
            ? String(updatedRecipe.yieldUnit || "")
                .trim()
                .toUpperCase()
            : "";

        if (explicitItemId && explicitItemId !== itemId) {
          const explicitItem = await db.item.findUnique({
            where: { id: explicitItemId },
          });
          if (explicitItem) {
            itemId = explicitItem.id;
            ensuredItem =
              recipeYieldUnit && !explicitItem.consumptionUm
                ? await db.item.update({
                    where: { id: explicitItem.id },
                    data: { consumptionUm: recipeYieldUnit },
                  })
                : explicitItem;
            await db.recipe.update({
              where: { id: updatedRecipe.id },
              data: {
                itemId,
                variationId: null,
              },
            });
          }
        }

        if (!itemId) {
          let item = await db.item.findFirst({
            where: { name: updatedRecipe.name },
            orderBy: { updatedAt: "desc" },
          });

          if (!item) {
            const isSemiFinished = updatedRecipe.type === "semiFinished";
            linkedItemWasCreated = true;
            item = await db.item.create({
              data: {
                name: updatedRecipe.name,
                description: updatedRecipe.description || null,
                classification: isSemiFinished
                  ? "semi_acabado"
                  : "produto_final",
                active: true,
                canPurchase: false,
                canTransform: true,
                canSell: !isSemiFinished,
                canStock: true,
                consumptionUm: recipeYieldUnit || null,
              },
            });
          } else if (recipeYieldUnit && !item.consumptionUm) {
            item = await db.item.update({
              where: { id: item.id },
              data: { consumptionUm: recipeYieldUnit },
            });
          }

          itemId = item.id;
          ensuredItem = item;

          await db.recipe.update({
            where: { id: updatedRecipe.id },
            data: {
              itemId,
              variationId: null,
            },
          });
        }

        if (itemId) {
          await db.recipe.update({
            where: { id: updatedRecipe.id },
            data: { variationId: null },
          });
        }

        if (!ensuredItem && itemId) {
          ensuredItem = await db.item.findUnique({
            where: { id: itemId },
            select: { id: true, name: true },
          });
        }

        if (itemId && previousItemId !== itemId) {
          const [targetVariations, recipeIngredients] = await Promise.all([
            db.itemVariation.findMany({
              where: { itemId, deletedAt: null },
              select: { id: true },
              orderBy: [{ createdAt: "asc" }],
            }),
            typeof db?.recipeIngredient?.findMany === "function"
              ? db.recipeIngredient.findMany({
                  where: { recipeId: updatedRecipe.id },
                  select: { id: true },
                })
              : Promise.resolve([]),
          ]);

          await db.itemVariation.updateMany({
            where: { recipeId: updatedRecipe.id, deletedAt: null },
            data: { recipeId: null },
          });

          if (targetVariations.length > 0) {
            await db.itemVariation.updateMany({
              where: {
                id: {
                  in: targetVariations.map((row: { id: string }) => row.id),
                },
              },
              data: { recipeId: updatedRecipe.id },
            });
          }

          if (
            recipeIngredients.length > 0 &&
            typeof db?.recipeVariationIngredient?.deleteMany === "function"
          ) {
            await db.recipeVariationIngredient.deleteMany({
              where: {
                recipeIngredientId: {
                  in: recipeIngredients.map((row: { id: string }) => row.id),
                },
              },
            });
          }

          if (
            recipeIngredients.length > 0 &&
            targetVariations.length > 0 &&
            typeof db?.recipeVariationIngredient?.createMany === "function"
          ) {
            const data = recipeIngredients.flatMap(
              (ingredient: { id: string }) =>
                targetVariations.map((variation: { id: string }) => ({
                  recipeIngredientId: ingredient.id,
                  itemVariationId: variation.id,
                  unit: "UN",
                  quantity: 0,
                  lossPct: null,
                }))
            );
            if (data.length > 0) {
              await db.recipeVariationIngredient.createMany({
                data,
                skipDuplicates: true,
              });
            }
          }
        }

        if (
          ensuredItem &&
          String(values.createItemCostSheet || "")
            .trim()
            .toLowerCase() === "yes"
        ) {
          const { rootSheetId } = await ensureItemCostSheetForRecipe({
            db,
            item: ensuredItem,
            recipe: {
              id: updatedRecipe.id,
              name: updatedRecipe.name,
            },
          });

          return redirect(
            buildRecipeCostSheetCreatedHref(
              String(values.recipeId || "").trim(),
              currentSection,
              rootSheetId
            )
          );
        }

        if (linkedItemWasCreated && ensuredItem?.id) {
          return redirect(
            buildRecipeLinkedItemCreatedHref({
              recipeId: String(values.recipeId || "").trim(),
              section: currentSection,
              itemId: String(ensuredItem.id),
              unit: ensuredItem.consumptionUm || null,
            })
          );
        }
      }
    } catch (_error) {
      // best effort: preserve legacy behavior when migrations are pending
    }

    const recipeId = String(values.recipeId || "").trim();
    return costingChanged || isItemChangeRequested
      ? buildRecipeCostSheetRecalculationRedirect(recipeId, currentSection)
      : buildRecipeSectionRedirect(recipeId, currentSection);
  }

  if (_action === "recipe-procedure-update") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    const [err] = await prismaIt(
      recipeEntity.update(recipeId, {
        productionProcedure:
          String(values?.productionProcedure || "").trim() || null,
      })
    );

    if (err) {
      return badRequest(err);
    }

    return redirect(`/admin/recipes/${recipeId}/procedimento/editar`);
  }

  if (_action === "recipe-procedure-notes-update") {
    const recipeId = String(values.recipeId || "").trim();
    if (!recipeId) return badRequest("Receita inválida");

    const [err] = await prismaIt(
      recipeEntity.update(recipeId, {
        productionNotes: String(values?.productionNotes || "").trim() || null,
      })
    );

    if (err) {
      return badRequest(err);
    }

    return redirect(`/admin/recipes/${recipeId}/procedimento/editar`);
  }

  if (_action === "recipe-procedure-yield-update") {
    const recipeId = String(values.recipeId || "").trim();
    const yieldQuantity = parseDecimalInput(values.yieldQuantity);
    const yieldUnit = String(values.yieldUnit || "")
      .trim()
      .toUpperCase();

    if (!recipeId) return badRequest("Receita inválida");
    if (
      yieldQuantity === null ||
      Number.isNaN(yieldQuantity) ||
      yieldQuantity <= 0
    ) {
      return badRequest("Informe quanto a receita rende");
    }
    if (!yieldUnit) {
      return badRequest("Informe a unidade do rendimento");
    }

    const [err] = await prismaIt(
      recipeEntity.update(recipeId, {
        costingMode: "yield",
        yieldQuantity,
        yieldUnit,
      })
    );

    if (err) {
      return badRequest(err);
    }

    return buildRecipeCostSheetRecalculationRedirect(recipeId, "procedimento");
  }

  return null;
}

export function InlineVariationCellEditor({
  recipeId,
  section,
  line,
  lineUnit,
  showVariationLoss,
  globalLossPct,
}: {
  recipeId: string;
  section: RecipeSection;
  line: any;
  lineUnit: string;
  showVariationLoss: boolean;
  globalLossPct: number;
}) {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const [lineQuantity, setLineQuantity] = useState(Number(line.quantity || 0));
  const [lineLossPct, setLineLossPct] = useState(
    Number(line.lossPct ?? line.defaultLossPct ?? 0)
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [defaultQty, setDefaultQty] = useState(Number(line.quantity || 0));
  const [defaultLossPct, setDefaultLossPct] = useState(
    Number(line.lossPct ?? line.defaultLossPct ?? 0)
  );
  const hasSubmittedRef = useRef(false);
  const baselineRef = useRef({
    quantity: Number(line.quantity || 0),
    lossPct: Number(line.lossPct ?? line.defaultLossPct ?? 0),
  });

  useEffect(() => {
    const nextQuantity = Number(line.quantity || 0);
    const nextLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0);
    setLineQuantity(nextQuantity);
    setLineLossPct(nextLossPct);
    setDefaultQty(nextQuantity);
    setDefaultLossPct(nextLossPct);
    baselineRef.current = {
      quantity: Number(line.quantity || 0),
      lossPct: Number(line.lossPct ?? line.defaultLossPct ?? 0),
    };
    setSaveStatus("idle");
  }, [line.id, line.quantity, line.lossPct, line.defaultLossPct]);

  useEffect(() => {
    if (!showVariationLoss) {
      setLineLossPct(Number(globalLossPct || 0));
      setDefaultLossPct(Number(globalLossPct || 0));
    }
  }, [showVariationLoss, globalLossPct]);

  function hasPendingChanges() {
    const nextQuantity = Number(lineQuantity || 0);
    const nextLossPct = showVariationLoss
      ? Number(lineLossPct || 0)
      : Number(globalLossPct || 0);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return false;
    if (!Number.isFinite(nextLossPct) || nextLossPct < 0 || nextLossPct >= 100)
      return false;
    if (showVariationLoss) {
      return (
        Math.abs(nextQuantity - baselineRef.current.quantity) > 0.0000001 ||
        Math.abs(nextLossPct - baselineRef.current.lossPct) > 0.0000001
      );
    }
    return Math.abs(nextQuantity - baselineRef.current.quantity) > 0.0000001;
  }

  const hasPending = hasPendingChanges();

  useEffect(() => {
    if (fetcher.state !== "idle") {
      hasSubmittedRef.current = true;
      setSaveStatus("saving");
      return;
    }

    if (!hasSubmittedRef.current) return;
    hasSubmittedRef.current = false;

    const fetcherStatus = Number((fetcher.data as any)?.status || 200);
    setSaveStatus(fetcherStatus >= 400 ? "error" : "saved");
  }, [fetcher.state, fetcher.data]);

  function submitAutoUpdate() {
    if (!formRef.current) return;
    if (!hasPending) return;
    const formData = new FormData(formRef.current);
    formData.set("_action", "recipe-line-update");
    hasSubmittedRef.current = true;
    setSaveStatus("saving");
    fetcher.submit(formData, {
      method: "post",
      action: "..",
      preventScrollReset: true,
    });
  }

  const effectiveLossPct = showVariationLoss
    ? Number(lineLossPct || 0)
    : Number(globalLossPct || 0);
  const saveMessage =
    saveStatus === "saving"
      ? "Salvando valor..."
      : saveStatus === "saved"
      ? "Valor salvo."
      : saveStatus === "error"
      ? String((fetcher.data as any)?.message || "Erro ao salvar.")
      : hasPending
      ? "Alteração pendente."
      : Number(lineQuantity || 0) <= 0
      ? "Informe a quantidade."
      : "Sem alterações pendentes.";

  return (
    <fetcher.Form
      action=".."
      method="post"
      ref={formRef}
      preventScrollReset
      onBlurCapture={() => {
        window.setTimeout(() => {
          const activeElement = document.activeElement;
          if (formRef.current?.contains(activeElement)) return;
          submitAutoUpdate();
        }, 0);
      }}
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="tab" value={section} />
      <input type="hidden" name="recipeLineId" value={line.id} />
      <input
        type="hidden"
        name="lineUnit"
        value={String(lineUnit || "UN").toUpperCase()}
      />
      {!showVariationLoss ? (
        <input
          type="hidden"
          name="lineLossPct"
          value={String(effectiveLossPct)}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <DecimalInput
            name="lineQuantity"
            defaultValue={defaultQty}
            fractionDigits={3}
            onValueChange={(value) => {
              setLineQuantity(value);
              setSaveStatus("pending");
            }}
            className="w-24 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
          />
          {showVariationLoss ? (
            <div className="flex items-center gap-0.5">
              <DecimalInput
                name="lineLossPct"
                defaultValue={defaultLossPct}
                fractionDigits={3}
                onValueChange={(value) => {
                  setLineLossPct(value);
                  setSaveStatus("pending");
                }}
                className="w-16 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
              />
              <span className="text-[11px] text-slate-400">%</span>
            </div>
          ) : null}
          <span
            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
              hasPending ? "bg-amber-400" : "bg-emerald-400"
            }`}
            title={hasPending ? "Alterações pendentes" : "Salvo"}
          />
        </div>
        <div className="space-y-1 text-[11px] text-slate-400">
          <div
            className={cn(
              "text-[11px]",
              saveStatus === "error"
                ? "text-red-500"
                : saveStatus === "saving"
                ? "text-amber-600"
                : saveStatus === "saved"
                ? "text-emerald-600"
                : "text-slate-400"
            )}
            aria-live="polite"
          >
            {saveMessage}
          </div>
        </div>
      </div>
    </fetcher.Form>
  );
}

export function IngredientUnitEditor({
  recipeId,
  section,
  recipeIngredientId,
  currentUnit,
  options,
}: {
  recipeId: string;
  section: RecipeSection;
  recipeIngredientId: string | null;
  currentUnit: string;
  options: string[];
}) {
  const fetcher = useFetcher();
  const [unit, setUnit] = useState(currentUnit);

  useEffect(() => {
    setUnit(currentUnit);
  }, [currentUnit, recipeIngredientId]);

  const handleUnitChange = (nextUnit: string) => {
    setUnit(nextUnit);
    const formData = new FormData();
    formData.set("recipeId", recipeId);
    formData.set("tab", section);
    formData.set("recipeIngredientId", recipeIngredientId || "");
    formData.set("lineUnit", nextUnit);
    formData.set("_action", "recipe-ingredient-unit-update");
    fetcher.submit(formData, { method: "post", action: ".." });
  };

  return (
    <Select value={unit} onValueChange={handleUnitChange}>
      <SelectTrigger className="h-8 w-20 text-sm border-slate-200">
        <SelectValue placeholder="UM" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function IngredientLossEditor({
  recipeId,
  section,
  recipeIngredientId,
  defaultLossPct,
}: {
  recipeId: string;
  section: RecipeSection;
  recipeIngredientId: string | null;
  defaultLossPct: number;
}) {
  const [lossPct, setLossPct] = useState(Number(defaultLossPct || 0));

  useEffect(() => {
    setLossPct(Number(defaultLossPct || 0));
  }, [defaultLossPct, recipeIngredientId]);

  return (
    <Form method="post" action="..">
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="tab" value={section} />
      <input
        type="hidden"
        name="recipeIngredientId"
        value={recipeIngredientId || ""}
      />
      <input type="hidden" name="defaultLossPct" value={String(lossPct)} />
      <input
        type="hidden"
        name="_action"
        value="recipe-ingredient-loss-update"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-0.5">
          <DecimalInput
            name="defaultLossPctInput"
            defaultValue={Number(defaultLossPct || 0)}
            fractionDigits={3}
            onValueChange={setLossPct}
            className="w-20 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
          />
          <span className="text-[11px] text-slate-400">%</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="submit"
            name="applyToLines"
            value="no"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Salvar perda padrão"
            aria-label="Salvar perda padrão"
          >
            <Check size={11} />
          </Button>
          <Button
            type="submit"
            name="applyToLines"
            value="yes"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Aplicar para todas as variações"
            aria-label="Aplicar para todas as variações"
          >
            <RefreshCw size={11} />
          </Button>
        </div>
      </div>
    </Form>
  );
}

export type AdminRecipeOutletContext = {
  recipe: Recipe;
  items: Array<{
    id: string;
    name: string;
    classification?: string | null;
    consumptionUm?: string | null;
  }>;
  recipeLines: any[];
  unitOptions: string[];
  chatGptProjectUrl: string;
  linkedVariations: Array<{
    itemVariationId: string;
    variationId: string | null;
    variationName: string | null;
    variationKind?: string | null;
    variationCode?: string | null;
    isReference?: boolean;
  }>;
};

const recipeNavigation: Array<{
  name: string;
  key: string;
  to: (recipeId: string) => string;
}> = [
  {
    name: "Cadastro",
    key: "cadastro",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "cadastro"),
  },
  {
    name: "Procedimento",
    key: "procedimento",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "procedimento"),
  },
  {
    name: "Composição",
    key: "composicao",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "composicao"),
  },
  {
    name: "Variações",
    key: "variacoes",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "variacoes"),
  },
  {
    name: "Fichas técnicas",
    key: "fichas",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "fichas"),
  },
  {
    name: "Receitas",
    key: "receitas",
    to: (recipeId) => buildRecipeSectionHref(recipeId, "receitas"),
  },
  {
    name: "Assistente",
    key: "composition-builder",
    to: (recipeId) => `/admin/recipes/${recipeId}/composition-builder`,
  },
];

export default function AdminRecipeDetailLayout() {
  const loaderData: HttpResponse | null = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const recipe = loaderData?.payload?.recipe as Recipe;
  const items = (loaderData?.payload?.items ||
    []) as AdminRecipeOutletContext["items"];
  const recipeLines = (loaderData?.payload?.recipeLines ||
    []) as AdminRecipeOutletContext["recipeLines"];
  const unitOptions = (loaderData?.payload?.unitOptions ||
    []) as AdminRecipeOutletContext["unitOptions"];
  const chatGptProjectUrl = String(
    loaderData?.payload?.chatGptProjectUrl || DEFAULT_RECIPE_CHATGPT_PROJECT_URL
  );
  const linkedVariations = (loaderData?.payload?.linkedVariations ||
    []) as AdminRecipeOutletContext["linkedVariations"];
  const recipeCostSheetCount = Number(
    loaderData?.payload?.recipeCostSheetCount || 0
  );
  const recipeLinksCount = Number(loaderData?.payload?.recipeLinksCount || 0);
  const isYieldRecipe = String((recipe as any)?.costingMode || "") === "yield";
  const recipeYieldQuantityText = isYieldRecipe
    ? formatRecipeQuantity((recipe as any)?.yieldQuantity)
    : "";
  const recipeYieldUnit = String((recipe as any)?.yieldUnit || "")
    .trim()
    .toUpperCase();
  const recipeYieldLabel = recipeYieldQuantityText
    ? `${recipeYieldQuantityText} ${recipeYieldUnit || "UM"}`
    : "";
  const linkedItem = items.find((item) => item.id === recipe?.itemId);
  const referenceVariation =
    linkedVariations.find((variation) => variation.isReference) ||
    linkedVariations[0] ||
    null;
  const summaryLines = referenceVariation
    ? recipeLines.filter(
        (line) =>
          String(line.ItemVariation?.id || "") ===
          referenceVariation.itemVariationId
      )
    : recipeLines;
  const recipeLineCount = summaryLines.length;
  const lastSegment = lastUrlSegment(location.pathname);
  const activeTab = location.pathname.includes(
    `/admin/recipes/${recipe?.id}/procedimento`
  )
    ? "procedimento"
    : location.pathname.includes(`/admin/recipes/${recipe?.id}/receitas`)
    ? "receitas"
    : lastSegment === "composition-builder"
    ? "composition-builder"
    : resolveRecipeSection(lastSegment);
  const createdCostSheetId = String(
    searchParams.get("createdCostSheetId") || ""
  ).trim();
  const createdCostSheetHref = createdCostSheetId
    ? `/admin/item-cost-sheets/${createdCostSheetId}/custos`
    : "";
  const linkedItemCreatedId = String(
    searchParams.get("linkedItemCreatedId") || ""
  ).trim();
  const linkedItemCreatedUnit = String(searchParams.get("linkedItemUnit") || "")
    .trim()
    .toUpperCase();
  const linkedItemCreatedHref = linkedItemCreatedId
    ? `/admin/items/${linkedItemCreatedId}/main`
    : "";
  const showCostSheetRecalculationNotice =
    searchParams.get("recalculateCostSheet") === "yes" &&
    recipeCostSheetCount > 0;
  const handleCreatedCostSheetDialogOpenChange = (open: boolean) => {
    if (open) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("createdCostSheetId");
    setSearchParams(nextParams, {
      preventScrollReset: true,
      replace: true,
    });
  };
  const handleLinkedItemCreatedDialogOpenChange = (open: boolean) => {
    if (open) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("linkedItemCreatedId");
    nextParams.delete("linkedItemUnit");
    setSearchParams(nextParams, {
      preventScrollReset: true,
      replace: true,
    });
  };
  const dismissCostSheetRecalculationNotice = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("recalculateCostSheet");
    setSearchParams(nextParams, {
      preventScrollReset: true,
      replace: true,
    });
  };

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }
    if (actionData?.status && actionData.status >= 400) {
      toast({
        title: "Erro",
        description: actionData.message,
        variant: "destructive",
      });
    }
  }, [actionData]);

  if (!recipe) {
    const message =
      loaderData?.message || "Nao foi possivel carregar a receita.";
    return <div className="p-4 text-sm text-muted-foreground">{message}</div>;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6 bg-white pb-20 md:pb-24">
      <Dialog
        open={Boolean(createdCostSheetId)}
        onOpenChange={handleCreatedCostSheetDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ficha técnica criada</DialogTitle>
            <DialogDescription>
              A ficha técnica foi criada e vinculada a esta receita.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ID da ficha:{" "}
            <span className="font-mono text-xs font-semibold">
              {createdCostSheetId}
            </span>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCreatedCostSheetDialogOpenChange(false)}
            >
              Continuar na receita
            </Button>
            <Button asChild>
              <Link
                to={createdCostSheetHref}
                target="_blank"
                rel="noreferrer"
                className="gap-2"
              >
                Abrir ficha técnica
                <ExternalLink size={14} />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(linkedItemCreatedId)}
        onOpenChange={handleLinkedItemCreatedDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Item vinculado criado</DialogTitle>
            <DialogDescription>
              O vínculo com item é opcional. Como nenhum item foi selecionado, o
              sistema criou um item para esta receita.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {linkedItemCreatedUnit ? (
              <>
                UM aplicada ao item:{" "}
                <span className="font-semibold">{linkedItemCreatedUnit}</span>.
              </>
            ) : (
              "Revise o item criado e defina a UM de consumo antes de usar esta receita em custos."
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleLinkedItemCreatedDialogOpenChange(false)}
            >
              Continuar na receita
            </Button>
            <Button asChild>
              <Link
                to={linkedItemCreatedHref}
                target="_blank"
                rel="noreferrer"
                className="gap-2"
              >
                Revisar item
                <ExternalLink size={14} />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCostSheetRecalculationNotice ? (
        <div
          role="alert"
          className="flex flex-col gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              É necessário recalcular a ficha técnica
            </p>
            <p className="text-xs text-amber-800">
              A composição ou o rendimento da receita mudou. Recalcule as
              fichas vinculadas para atualizar os custos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={buildRecipeSectionHref(recipe.id, "fichas")}>
                Ver fichas técnicas
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-800"
              onClick={dismissCostSheetRecalculationNotice}
              aria-label="Fechar aviso de recálculo"
              title="Fechar aviso"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950">
              {recipe.name}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                recipe.type === "pizzaTopping"
                  ? "bg-orange-50 text-orange-700 ring-orange-200"
                  : "bg-blue-50 text-blue-700 ring-blue-200"
              }`}
            >
              {recipe.type === "pizzaTopping" ? "Sabor Pizza" : "Produzido"}
            </span>
            {recipeYieldLabel ? (
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                Rendimento: {recipeYieldLabel}
              </span>
            ) : null}
          </div>
          {linkedItem ? (
            <Link
              to={`/admin/items/${linkedItem.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900 hover:underline"
              aria-label={`Abrir item ${linkedItem.name} em nova aba`}
            >
              {linkedItem.name}
              <ExternalLink
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
            </Link>
          ) : (
            <p className="text-sm text-slate-500">Sem item vinculado</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <Form method="post">
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="tab" value={activeTab} />
            <Button
              type="submit"
              name="_action"
              value="recipe-create-cost-sheet"
              variant="outline"
              size="sm"
              className="flex gap-x-2"
            >
              <FileSpreadsheet size={14} />
              Criar ficha técnica
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="tab" value={activeTab} />
            <Button
              type="submit"
              name="_action"
              value="recipe-duplicate"
              variant="outline"
              size="sm"
              className="flex gap-x-2"
            >
              <Copy size={14} />
              Duplicar receita
            </Button>
          </Form>
          <Form
            method="post"
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Eliminar a receita "${recipe.name}"? Esta ação não pode ser desfeita.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="recipeId" value={recipe.id} />
            <Button
              type="submit"
              name="_action"
              value="recipe-delete"
              variant="outline"
              size="sm"
              className="flex gap-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 size={14} />
              Eliminar receita
            </Button>
          </Form>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">
              Ingredientes
            </div>
            <div className="text-sm font-medium text-slate-900">
              {recipeLineCount}
            </div>
          </div>
        </div>
      </div>

      <nav className="overflow-x-auto border-b border-slate-100">
        <div className="flex min-w-max items-center gap-6 text-sm">
          {recipeNavigation.map((navItem) => {
            const isActive = activeTab === navItem.key;
            const count =
              navItem.key === "fichas"
                ? recipeCostSheetCount
                : navItem.key === "receitas"
                ? recipeLinksCount
                : null;
            return (
              <Link
                key={navItem.key}
                to={navItem.to(recipe.id)}
                className={cn(
                  "border-b-2 pb-3 font-medium transition",
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {navItem.name.toLowerCase()}
                  {count !== null ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        isActive
                          ? "bg-slate-900 text-white"
                          : count > 0
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Outlet
        context={{
          recipe,
          items,
          recipeLines,
          unitOptions,
          chatGptProjectUrl,
          linkedVariations,
        }}
      />
    </div>
  );
}
