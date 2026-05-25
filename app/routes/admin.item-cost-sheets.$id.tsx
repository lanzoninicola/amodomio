import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation, type ShouldRevalidateFunction } from "@remix-run/react";

export const shouldRevalidate: ShouldRevalidateFunction = ({ nextUrl }) => {
  return nextUrl.pathname.endsWith("/custos");
};
import {
  calcItemCostSheetTotalCostAmount,
  getItemCostSheetItemSnapshot,
  getRecipeCompositionCostSnapshot,
  getItemCostSheetSnapshot,
  recalcItemCostSheetTotals,
  resolveRecipeIngredientCostSnapshot,
  roundItemCostSheetMoney,
} from "~/domain/costs/item-cost-sheet-recalc.server";
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

type SheetCompositionRow = {
  id: string;
  componentId: string;
  type: string;
  refId: string | null;
  presetId: string | null;
  presetName: string | null;
  name: string;
  sortOrderIndex: number;
  notes: string | null;
  variationValues: Array<{
    itemVariationId: string;
    variationComponentId: string | null;
    unit: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
    totalCostAmount: number;
  }>;
};

type ComponentPresetRecord = {
  id: string;
  key: string;
  type: string;
  variationId: string | null;
  variationLabel: string | null;
  variationCode: string | null;
  variationKind: string | null;
  name: string;
  unit?: string | null;
  quantity: number;
  unitCostAmount: number;
  wastePerc: number;
  notes?: string | null;
};

type PackagingItemOption = {
  id: string;
  name: string;
  classification: string | null;
  purchaseUm: string | null;
  consumptionUm: string | null;
  unitCostAmount: number;
};

type RecipeCompositionBreakdownLine = {
  ingredientId: string;
  itemId: string;
  itemName: string;
  ingredientVariationId: string | null;
  ingredientVariationLabel: string | null;
  unit: string;
  quantity: number;
  lossPct: number;
  grossQuantity: number;
  avgUnitCostAmount: number;
  totalCostAmount: number;
  notes: string | null;
};

type RecipeCompositionBreakdown = {
  recipeId: string;
  recipeName: string;
  ownerItemVariationId: string;
  ownerVariationLabel: string | null;
  unitCostAmount: number;
  lines: RecipeCompositionBreakdownLine[];
};

function normalizeUnit(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function buildPresetVariationEntries(params: {
  preset: {
    variationId?: string | null;
    unit?: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
  };
  targetVariationRows: Array<{
    itemVariationId: string;
    variationId: string | null;
  }>;
  unit: string | null;
  quantity: number;
  unitCostAmount: number;
  wastePerc: number;
}) {
  const {
    preset,
    targetVariationRows,
    unit,
    quantity,
    unitCostAmount,
    wastePerc,
  } = params;

  if (!preset.variationId) return null;

  const matchingRows = targetVariationRows.filter(
    (row) => row.variationId && row.variationId === preset.variationId
  );
  if (matchingRows.length === 0) return null;

  return targetVariationRows.map((row) => {
    const matches = row.variationId && row.variationId === preset.variationId;
    return {
      itemVariationId: row.itemVariationId,
      unit,
      quantity,
      unitCostAmount: matches ? unitCostAmount : 0,
      wastePerc,
    };
  });
}

async function getAvailableItemUnits() {
  const db = prismaClient as any;
  const staticUnits = ITEM_UNIT_OPTIONS;
  let dbUnits: Array<{ code?: string | null }> | undefined;
  const measurementUnitModel = db.measurementUnit;

  if (typeof measurementUnitModel?.findMany !== "function") {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    dbUnits = await measurementUnitModel.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    });
  } catch (_error) {
    // fallback para ambientes sem tabela measurement_units
  }

  const merged = new Set<string>(staticUnits);
  for (const row of dbUnits || []) {
    const code = normalizeUnit(row?.code);
    if (code) merged.add(code);
  }

  return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function listActiveItemVariationIdsForItem(db: any, itemId?: string | null) {
  const normalizedItemId = String(itemId || "").trim();
  if (!normalizedItemId) return [] as string[];

  const rows = await db.itemVariation.findMany({
    where: { itemId: normalizedItemId, deletedAt: null },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  });

  return (rows || []).map((row: any) => String(row.id || "")).filter(Boolean);
}

async function listItemCostSheetCompositionRows(
  db: any,
  params: { itemCostSheetId: string; itemVariationIds: string[] }
): Promise<SheetCompositionRow[]> {
  const components = await db.itemCostSheetComponent.findMany({
    where: { itemCostSheetId: params.itemCostSheetId },
    include: {
      ItemCostSheetVariationComponent: {
        where: {
          itemVariationId: {
            in: params.itemVariationIds,
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      preset: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });

  return components.map((component: any) => {
    const variationValues = Array.isArray(component.ItemCostSheetVariationComponent)
      ? component.ItemCostSheetVariationComponent
      : [];

    return {
      id: component.id,
      componentId: component.id,
      type: String(component.type || "manual"),
      refId: component.refId || null,
      presetId: component.presetId || null,
      presetName: component.preset?.name || null,
      name: component.name,
      sortOrderIndex: Number(component.sortOrderIndex || 0),
      notes: component.notes || null,
      variationValues: params.itemVariationIds.map((itemVariationId) => {
        const value = variationValues.find((row: any) => row.itemVariationId === itemVariationId) || null;
        return {
          itemVariationId,
          variationComponentId: value?.id || null,
          unit: value?.unit || null,
          quantity: Number(value?.quantity || 0),
          unitCostAmount: Number(value?.unitCostAmount || 0),
          wastePerc: Number(value?.wastePerc || 0),
          totalCostAmount: Number(value?.totalCostAmount || 0),
        };
      }),
    };
  });
}

async function buildRecipeCompositionBreakdownMap(
  db: any,
  params: {
    compositionRows: SheetCompositionRow[];
    variationSheets: Array<{
      itemVariationId: string;
      ItemVariation?: { Variation?: { name?: string | null } | null } | null;
    }>;
  }
) {
  const recipeRows = params.compositionRows.filter(
    (line) => line.type === "recipe" && line.refId
  );
  if (recipeRows.length === 0 || params.variationSheets.length === 0) {
    return {} as Record<string, Record<string, RecipeCompositionBreakdown>>;
  }

  const ownerVariationIds = params.variationSheets
    .map((sheet) => String(sheet.itemVariationId || ""))
    .filter(Boolean);

  const ownerVariations = await db.itemVariation.findMany({
    where: { id: { in: ownerVariationIds } },
    select: {
      id: true,
      variationId: true,
      Variation: { select: { name: true } },
    },
  });

  const ownerVariationMap = new Map(
    ownerVariations.map((row: any) => [
      String(row.id),
      {
        variationId: row.variationId ? String(row.variationId) : null,
        variationLabel: row.Variation?.name || null,
      },
    ])
  );

  const uniqueRecipeIds = Array.from(
    new Set(recipeRows.map((line) => String(line.refId || "")).filter(Boolean))
  );

  const recipeEntries = await Promise.all(
    uniqueRecipeIds.map(async (recipeId) => {
      const recipe = await db.recipe.findUnique({
        where: { id: recipeId },
        select: { id: true, name: true },
      });
      const allLines = await listRecipeCompositionLines(db, recipeId);
      return [
        recipeId,
        {
          recipeName: recipe?.name || "Receita",
          allLines,
        },
      ] as const;
    })
  );

  const recipeCache = new Map(recipeEntries);
  const costSnapshotCache = new Map<string, { avgUnitCostAmount: number }>();

  async function getAvgCost(itemId: string, variationId?: string | null) {
    const cacheKey = `${itemId}::${variationId || ""}`;
    const cached = costSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const snapshot = await resolveRecipeIngredientCostSnapshot({
      db,
      itemId,
      variationId: variationId || null,
    });
    const result = { avgUnitCostAmount: Number(snapshot.avgUnitCostAmount || 0) };
    costSnapshotCache.set(cacheKey, result);
    return result;
  }

  const breakdownEntries = await Promise.all(
    recipeRows.map(async (line) => {
      const recipeId = String(line.refId || "");
      const recipeData = recipeCache.get(recipeId);
      const byVariation = await Promise.all(
        params.variationSheets.map(async (sheet) => {
          const ownerItemVariationId = String(sheet.itemVariationId || "");
          const ownerVariation = ownerVariationMap.get(ownerItemVariationId);
          const ownerVariationId = ownerVariation?.variationId || null;

          const filteredLines = ownerVariationId
            ? recipeData?.allLines.filter(
                (recipeLine) =>
                  String(recipeLine.ItemVariation?.variationId || "") ===
                  ownerVariationId
              ) || []
            : recipeData?.allLines || [];

          const breakdownLines = await Promise.all(
            filteredLines.map(async (recipeLine) => {
              const ingredientVariationId =
                recipeLine.ItemVariation?.variationId || null;
              const ingredientVariationLabel =
                recipeLine.ItemVariation?.Variation?.name || null;
              const lossPct = Number(
                recipeLine.lossPct ?? recipeLine.defaultLossPct ?? 0
              );
              const safeLossPct = Math.min(99.9999, Math.max(0, lossPct));
              const quantity = Number(recipeLine.quantity || 0);
              const grossQuantity =
                safeLossPct > 0
                  ? Number((quantity / (1 - safeLossPct / 100)).toFixed(6))
                  : quantity;
              const costInfo = await getAvgCost(
                recipeLine.itemId,
                ingredientVariationId
              );
              const totalCostAmount = Number(
                (Number(costInfo.avgUnitCostAmount || 0) * grossQuantity).toFixed(6)
              );

              return {
                ingredientId: String(recipeLine.recipeIngredientId || recipeLine.id),
                itemId: recipeLine.itemId,
                itemName: recipeLine.Item?.name || "Ingrediente",
                ingredientVariationId,
                ingredientVariationLabel,
                unit: recipeLine.unit,
                quantity,
                lossPct,
                grossQuantity,
                avgUnitCostAmount: Number(costInfo.avgUnitCostAmount || 0),
                totalCostAmount,
                notes: recipeLine.notes || null,
              } satisfies RecipeCompositionBreakdownLine;
            })
          );

          const unitCostAmount = breakdownLines.reduce(
            (acc, breakdownLine) => acc + Number(breakdownLine.totalCostAmount || 0),
            0
          );

          return [
            ownerItemVariationId,
            {
              recipeId,
              recipeName: recipeData?.recipeName || line.name || "Receita",
              ownerItemVariationId,
              ownerVariationLabel:
                ownerVariation?.variationLabel ||
                sheet.ItemVariation?.Variation?.name ||
                null,
              unitCostAmount: roundItemCostSheetMoney(unitCostAmount),
              lines: breakdownLines,
            } satisfies RecipeCompositionBreakdown,
          ] as const;
        })
      );

      return [line.id, Object.fromEntries(byVariation)] as const;
    })
  );

  return Object.fromEntries(breakdownEntries) as Record<
    string,
    Record<string, RecipeCompositionBreakdown>
  >;
}

async function createItemCostSheetRow(params: {
  db: any;
  itemCostSheetId: string;
  itemVariationId: string;
  targetItemVariationIds?: string[];
  variationEntries?: Array<{
    itemVariationId: string;
    unit?: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
  }>;
  type: string;
  refId?: string | null;
  presetId?: string | null;
  name: string;
  unit?: string | null;
  quantity: number;
  unitCostAmount: number;
  wastePerc: number;
  notes?: string | null;
}) {
  const {
    db,
    itemCostSheetId,
    itemVariationId,
    targetItemVariationIds,
    variationEntries,
    type,
    refId,
    presetId,
    name,
    unit,
    quantity,
    unitCostAmount,
    wastePerc,
    notes,
  } = params;

  const lineCount = await db.itemCostSheetComponent.count({ where: { itemCostSheetId } });
  const normalizedVariationEntries = Array.isArray(variationEntries) && variationEntries.length > 0
    ? variationEntries
    : Array.from(
      new Set((targetItemVariationIds && targetItemVariationIds.length > 0 ? targetItemVariationIds : [itemVariationId]).filter(Boolean))
    ).map((targetItemVariationId) => ({
      itemVariationId: targetItemVariationId,
      unit: unit || null,
      quantity,
      unitCostAmount,
      wastePerc,
    }));
  await db.itemCostSheetComponent.create({
    data: {
      itemCostSheetId,
      type,
      refId: refId || null,
      presetId: presetId || null,
      name,
      notes: notes || null,
      sortOrderIndex: Number(lineCount || 0),
      ItemCostSheetVariationComponent: {
        create: normalizedVariationEntries.map((entry) => ({
          itemVariationId: entry.itemVariationId,
          unit: entry.unit || null,
          quantity: entry.quantity,
          unitCostAmount: entry.unitCostAmount,
          wastePerc: entry.wastePerc,
          totalCostAmount: calcItemCostSheetTotalCostAmount(entry.unitCostAmount, entry.quantity, entry.wastePerc),
        })),
      },
    },
  });
}

async function wouldCreateRecipeSheetCycle(
  db: any,
  sourceItemCostSheetId: string,
  targetItemCostSheetId: string
) {
  if (!sourceItemCostSheetId || !targetItemCostSheetId) return false;
  if (sourceItemCostSheetId === targetItemCostSheetId) return true;

  const visited = new Set<string>();
  const stack = [targetItemCostSheetId];

  while (stack.length > 0) {
    const currentId = stack.pop() as string;
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === sourceItemCostSheetId) return true;

    const refs = await db.itemCostSheetComponent.findMany({
      where: { itemCostSheetId: currentId, type: "recipeSheet" },
      select: { refId: true },
    });

    for (const ref of refs) {
      const nextId = String(ref.refId || "").trim();
      if (nextId && !visited.has(nextId)) stack.push(nextId);
    }
  }

  return false;
}

function sheetDetailHref(itemCostSheetId: string) {
  return `/admin/item-cost-sheets/${itemCostSheetId}`;
}

function getPostRedirectTarget(formData: FormData, itemCostSheetId: string) {
  const redirectTo = String(formData.get("redirectTo") || "").trim();
  return redirectTo || sheetDetailHref(itemCostSheetId);
}

async function getItemCostSheetDeletionGuard(
  db: any,
  params: { itemCostSheetId: string; isActive?: boolean | null }
) {
  const [referenceDependencyCount, baseDependencyCount] = await Promise.all([
    db.itemCostSheetComponent.count({
      where: { type: "recipeSheet", refId: params.itemCostSheetId },
    }),
    db.itemCostSheet.count({
      where: { baseItemCostSheetId: params.itemCostSheetId },
    }),
  ]);

  if (params.isActive) {
    return {
      canDelete: false,
      reason: "Não é permitido eliminar uma ficha ativa. Desative ou substitua a ficha antes de remover.",
      referenceDependencyCount,
      baseDependencyCount,
    };
  }

  if (referenceDependencyCount > 0) {
    return {
      canDelete: false,
      reason: "Não é permitido eliminar uma ficha usada por outras fichas de custo.",
      referenceDependencyCount,
      baseDependencyCount,
    };
  }

  return {
    canDelete: true,
    reason: null,
    referenceDependencyCount,
    baseDependencyCount,
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const itemCostSheetId = String(params.id || "").trim();
    if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
    const pathname = new URL(request.url).pathname;

    const db = prismaClient as any;
    const currentSheet = await db.itemCostSheet.findUnique({
      where: { id: itemCostSheetId },
      include: {
        Item: { select: { id: true, name: true } },
        ItemVariation: { include: { Variation: true } },
      },
    });

    if (!currentSheet) return badRequest("Ficha de custo não encontrada");
    const rootSheetId = currentSheet.baseItemCostSheetId || currentSheet.id;
    const isCostsTabRequest = pathname.endsWith("/custos");

    const [recipeSheets, recipes, referenceSheets, packagingItems, componentPresets, recipeSheetDependencyAgg, unitOptions, activeItemVariationIds] = await Promise.all([
      db.itemCostSheet.findMany({
        where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
        include: {
          ItemVariation: { include: { Variation: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      isCostsTabRequest
        ? db.recipe.findMany({
          where: {},
          select: {
            id: true,
            name: true,
            type: true,
            variationId: true,
            Variation: { select: { id: true, name: true, kind: true } },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 300,
        })
        : Promise.resolve([]),
      isCostsTabRequest
        ? db.itemCostSheet.findMany({
          where: { isActive: true, baseItemCostSheetId: null },
          select: { id: true, name: true, itemId: true, costAmount: true },
          orderBy: [{ updatedAt: "desc" }],
          take: 300,
        })
        : Promise.resolve([]),
      isCostsTabRequest
        ? db.item.findMany({
          where: { active: true, classification: "embalagem" },
          select: {
            id: true,
            name: true,
            classification: true,
            purchaseUm: true,
            consumptionUm: true,
          },
          orderBy: [{ name: "asc" }],
          take: 300,
        })
        : Promise.resolve([]),
      isCostsTabRequest
        ? db.itemCostSheetComponentPreset.findMany({
          where: { active: true, type: { in: ["manual", "labor"] } },
          select: {
            id: true,
            key: true,
            type: true,
            variationId: true,
            name: true,
            unit: true,
            quantity: true,
            unitCostAmount: true,
            wastePerc: true,
            notes: true,
            sortOrderIndex: true,
            Variation: { select: { id: true, name: true, code: true, kind: true } },
          },
          orderBy: [{ type: "asc" }, { sortOrderIndex: "asc" }, { name: "asc" }],
        })
        : Promise.resolve([]),
      db.itemCostSheetComponent.groupBy({
        by: ["refId"],
        where: { type: "recipeSheet", refId: { not: null } },
        _count: { _all: true },
      }),
      getAvailableItemUnits(),
      listActiveItemVariationIdsForItem(db, currentSheet.itemId),
    ]);

    const activeVariationIdSet = new Set(activeItemVariationIds);
    const visibleRecipeSheets = recipeSheets.filter((sheet: any) =>
      activeVariationIdSet.size === 0 || activeVariationIdSet.has(String(sheet.itemVariationId || ""))
    );

    const recipeOptions = isCostsTabRequest
      ? recipes.map((recipe: any) => ({
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        variationLabel: recipe.Variation?.name || null,
      }))
      : [];

    const recipeSheetDependencyCountById = Object.fromEntries(
      (recipeSheetDependencyAgg || [])
        .filter((row: any) => row.refId)
        .map((row: any) => [String(row.refId), Number(row?._count?._all || 0)])
    );
    const packagingItemOptions = isCostsTabRequest
      ? await Promise.all(
        (packagingItems || []).map(async (item: any) => {
          const snapshot = await getItemCostSheetItemSnapshot(db, String(item.id || ""));
          return {
            id: String(item.id || ""),
            name: String(item.name || ""),
            classification: item.classification || null,
            purchaseUm: item.purchaseUm || null,
            consumptionUm: item.consumptionUm || null,
            unitCostAmount: Number(snapshot.unitCostAmount || 0),
          };
        })
      )
      : [];

    const compositionRows = await listItemCostSheetCompositionRows(db, {
      itemCostSheetId: rootSheetId,
      itemVariationIds: visibleRecipeSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean),
    });
    const recipeCompositionBreakdownByLineId = isCostsTabRequest
      ? await buildRecipeCompositionBreakdownMap(db, {
        compositionRows,
        variationSheets: visibleRecipeSheets,
      })
      : {};
    const deletionGuard = await getItemCostSheetDeletionGuard(db, {
      itemCostSheetId: rootSheetId,
      isActive: visibleRecipeSheets.some((sheet: any) => Boolean(sheet.isActive)),
    });

    return ok({
      item: currentSheet.Item,
      recipeSheets: visibleRecipeSheets,
      rootSheetId,
      variationSheets: visibleRecipeSheets,
      selectedSheetId: currentSheet.id,
      selectedSheet: currentSheet,
      compositionRows,
      recipeCompositionBreakdownByLineId,
      recipeOptions,
      referenceSheetOptions: referenceSheets,
      packagingItemOptions,
      componentPresets: (componentPresets || []).map((preset: any) => ({
        id: String(preset.id || ""),
        key: String(preset.key || ""),
        type: String(preset.type || "manual"),
        variationId: preset.variationId ? String(preset.variationId) : null,
        variationLabel: preset.Variation?.name || null,
        variationCode: preset.Variation?.code || null,
        variationKind: preset.Variation?.kind || null,
        name: String(preset.name || ""),
        unit: preset.unit || null,
        quantity: Number(preset.quantity || 1),
        unitCostAmount: Number(preset.unitCostAmount || 0),
        wastePerc: Number(preset.wastePerc || 0),
        notes: preset.notes || null,
      })),
      recipeSheetDependencyCountById,
      deletionGuard,
      unitOptions,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const routeSheetId = String(params.id || "").trim();
    if (!routeSheetId) return badRequest("Ficha de custo inválida");

    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");
    const db = prismaClient as any;

    const currentSheet = await db.itemCostSheet.findUnique({
      where: { id: routeSheetId },
      select: { id: true, itemId: true, itemVariationId: true, isActive: true, baseItemCostSheetId: true },
    });
    if (!currentSheet) return badRequest("Ficha de custo não encontrada");
    const postRedirectTo = getPostRedirectTarget(formData, currentSheet.id);
    const rootSheetId = currentSheet.baseItemCostSheetId || currentSheet.id;
    const [groupSheets, activeItemVariationIds] = await Promise.all([
      db.itemCostSheet.findMany({
        where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
        select: {
          id: true,
          itemVariationId: true,
          isActive: true,
          ItemVariation: {
            select: {
              variationId: true,
              Variation: { select: { id: true, name: true, code: true, kind: true } },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      listActiveItemVariationIdsForItem(db, currentSheet.itemId),
    ]);
    const availableUnits = await getAvailableItemUnits();
    const activeVariationIdSet = new Set(activeItemVariationIds);
    const visibleGroupSheets = groupSheets.filter((sheet: any) =>
      activeVariationIdSet.size === 0 || activeVariationIdSet.has(String(sheet.itemVariationId || ""))
    );
    const targetVariationRows = visibleGroupSheets
      .map((sheet: any) => ({
        itemVariationId: String(sheet.itemVariationId || ""),
        variationId: sheet.ItemVariation?.variationId ? String(sheet.ItemVariation.variationId) : null,
        variationName: sheet.ItemVariation?.Variation?.name || null,
      }))
      .filter((sheet) => sheet.itemVariationId);
    const targetItemVariationIds = targetVariationRows.map((sheet) => sheet.itemVariationId);

    if (_action === "item-cost-sheet-meta-update") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const notes = String(formData.get("notes") || "").trim();
      const isActive = String(formData.get("isActive") || "").trim() === "on";

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!name) return badRequest("Informe o nome da ficha");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      await db.itemCostSheet.updateMany({
        where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
        data: {
          name,
          description: description || null,
          notes: notes || null,
          isActive,
          status: isActive ? "active" : "draft",
          activatedAt: isActive ? new Date() : null,
        },
      });

      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-recipe") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const recipeId = String(formData.get("recipeId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!recipeId) return badRequest("Selecione a receita");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const snapshot = await getRecipeCompositionCostSnapshot(db, recipeId);
      const variationEntries = await Promise.all(
        targetItemVariationIds.map(async (targetItemVariationId) => {
          const perVariationSnapshot = await getRecipeCompositionCostSnapshot(
            db,
            recipeId,
            targetItemVariationId
          );
          return {
            itemVariationId: targetItemVariationId,
            unit: "receita",
            quantity,
            unitCostAmount: roundItemCostSheetMoney(perVariationSnapshot.unitCostAmount),
            wastePerc,
          };
        })
      );
      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        variationEntries,
        type: "recipe",
        refId: recipeId,
        name: snapshot.recipe.name,
        unit: "receita",
        quantity,
        unitCostAmount: roundItemCostSheetMoney(snapshot.unitCostAmount),
        wastePerc,
        notes: snapshot.note,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-item") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const refItemId = String(formData.get("refItemId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!refItemId) return badRequest("Selecione a embalagem");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const refItem = await db.item.findFirst({
        where: { id: refItemId, active: true, classification: "embalagem" },
        select: { id: true },
      });
      if (!refItem) return badRequest("Embalagem inválida ou inativa");

      const snapshot = await getItemCostSheetItemSnapshot(db, refItemId);
      const unit = normalizeUnit(snapshot.unit) || "UN";
      const variationEntries = targetItemVariationIds.map((targetItemVariationId) => ({
        itemVariationId: targetItemVariationId,
        unit,
        quantity,
        unitCostAmount: roundItemCostSheetMoney(snapshot.unitCostAmount),
        wastePerc,
      }));

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        variationEntries,
        type: "item",
        refId: refItemId,
        name: snapshot.item.name,
        unit,
        quantity,
        unitCostAmount: roundItemCostSheetMoney(snapshot.unitCostAmount),
        wastePerc,
        notes: snapshot.note,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-manual") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const presetId = String(formData.get("presetId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = normalizeUnit(formData.get("unit"));
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();
      const preset = presetId
        ? await db.itemCostSheetComponentPreset.findFirst({
          where: { id: presetId, active: true, type: "manual" },
          select: { id: true, variationId: true, name: true },
        })
        : null;

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (presetId && !preset) return badRequest("Preset de custo manual inválido");
      if (!name) return badRequest("Informe o nome do custo");
      if (!unit || !availableUnits.includes(unit)) return badRequest("Informe uma unidade válida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");
      const presetVariationEntries = preset
        ? buildPresetVariationEntries({
          preset: {
            variationId: preset.variationId ? String(preset.variationId) : null,
            quantity,
            unitCostAmount,
            wastePerc,
          },
          targetVariationRows,
          unit,
          quantity,
          unitCostAmount,
          wastePerc,
        })
        : null;
      if (preset?.variationId && !presetVariationEntries) {
        return badRequest(`O preset ${preset.name} está vinculado a uma variação ausente nesta ficha`);
      }

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        variationEntries: presetVariationEntries || undefined,
        type: "manual",
        presetId: preset?.id || null,
        name,
        unit,
        quantity,
        unitCostAmount,
        wastePerc,
        notes: notes || null,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-labor") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const presetId = String(formData.get("presetId") || "").trim();
      const name = String(formData.get("name") || "").trim() || "Mão de obra";
      const unit = normalizeUnit(formData.get("unit"));
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();
      const preset = presetId
        ? await db.itemCostSheetComponentPreset.findFirst({
          where: { id: presetId, active: true, type: "labor" },
          select: { id: true, variationId: true, name: true },
        })
        : null;

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (presetId && !preset) return badRequest("Preset de mão de obra inválido");
      if (!unit || !availableUnits.includes(unit)) return badRequest("Informe uma unidade válida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");
      const presetVariationEntries = preset
        ? buildPresetVariationEntries({
          preset: {
            variationId: preset.variationId ? String(preset.variationId) : null,
            quantity,
            unitCostAmount,
            wastePerc,
          },
          targetVariationRows,
          unit,
          quantity,
          unitCostAmount,
          wastePerc,
        })
        : null;
      if (preset?.variationId && !presetVariationEntries) {
        return badRequest(`O preset ${preset.name} está vinculado a uma variação ausente nesta ficha`);
      }

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        variationEntries: presetVariationEntries || undefined,
        type: "labor",
        presetId: preset?.id || null,
        name,
        unit,
        quantity,
        unitCostAmount,
        wastePerc,
        notes: notes || null,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-sheet") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const refSheetId = String(formData.get("refRecipeSheetId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!refSheetId) return badRequest("Selecione a ficha de custo de referência");
      if (itemCostSheetId === refSheetId) return badRequest("Não é permitido referenciar a própria ficha");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const createsCycle = await wouldCreateRecipeSheetCycle(db, rootSheetId, refSheetId);
      if (createsCycle) return badRequest("Esta referência criaria ciclo entre fichas de custo");

      const refSnapshot = await getItemCostSheetSnapshot(db, refSheetId, currentSheet.itemVariationId);
      const variationEntries = await Promise.all(
        targetItemVariationIds.map(async (targetItemVariationId) => {
          const perVariationSnapshot = await getItemCostSheetSnapshot(db, refSheetId, targetItemVariationId);
          return {
            itemVariationId: targetItemVariationId,
            unit: "ficha",
            quantity,
            unitCostAmount: roundItemCostSheetMoney(perVariationSnapshot.unitCostAmount),
            wastePerc,
          };
        })
      );

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        variationEntries,
        type: "recipeSheet",
        refId: refSheetId,
        name: refSnapshot.sheet.name,
        unit: "ficha",
        quantity,
        unitCostAmount: roundItemCostSheetMoney(refSnapshot.unitCostAmount),
        wastePerc,
        notes: refSnapshot.note,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-move") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const direction = String(formData.get("direction") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");
      if (!["up", "down"].includes(direction)) return badRequest("Direção inválida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const rows = await db.itemCostSheetComponent.findMany({
        where: { itemCostSheetId: rootSheetId },
        select: { id: true, sortOrderIndex: true, createdAt: true },
        orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
      });

      const currentIndex = rows.findIndex((row: any) => row.id === lineId);
      if (currentIndex < 0) return badRequest("Linha não encontrada");

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) {
        return redirect(postRedirectTo);
      }

      const current = rows[currentIndex];
      const target = rows[targetIndex];
      await db.$transaction([
        db.itemCostSheetComponent.update({
          where: { id: current.id },
          data: { sortOrderIndex: Number(target.sortOrderIndex || 0) },
        }),
        db.itemCostSheetComponent.update({
          where: { id: target.id },
          data: { sortOrderIndex: Number(current.sortOrderIndex || 0) },
        }),
      ]);

      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-update") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const notes = String(formData.get("notes") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const component = await db.itemCostSheetComponent.findFirst({
        where: { id: lineId, itemCostSheetId: rootSheetId },
        include: {
          ItemCostSheetVariationComponent: {
            where: { itemVariationId: { in: targetItemVariationIds } },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      });
      if (!component) return badRequest("Linha não encontrada");

      const isRefLine = (component.type === "recipe" || component.type === "recipeSheet" || component.type === "item") && !!component.refId;
      const variationValues = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent
        : [];
      const updates = targetItemVariationIds.map((itemVariationId) => {
        const existingValue = variationValues.find((value: any) => value.itemVariationId === itemVariationId) || null;
        const quantity = Number(String(formData.get(`quantity__${itemVariationId}`) || "0").replace(",", "."));
        const unitCostAmount = Number(String(formData.get(`unitCostAmount__${itemVariationId}`) || "0").replace(",", "."));
        const wastePerc = Number(String(formData.get(`wastePerc__${itemVariationId}`) || "0").replace(",", "."));
        const unitRaw = normalizeUnit(formData.get(`unit__${itemVariationId}`));

        return {
          existingValue,
          itemVariationId,
          unitRaw,
          quantity,
          unitCostAmount,
          wastePerc,
        };
      });
      if (updates.some((update) => !(update.quantity > 0))) {
        return badRequest("Informe uma quantidade válida para todas as variações");
      }
      if (!isRefLine && (component.type === "manual" || component.type === "labor")) {
        if (updates.some((update) => {
          const existingUnit = normalizeUnit(update.existingValue?.unit);
          return !update.unitRaw || (!availableUnits.includes(update.unitRaw) && update.unitRaw !== existingUnit);
        })) {
          return badRequest("Informe uma unidade válida para todas as variações");
        }
      }
      if (updates.some((update) => !(update.unitCostAmount >= 0))) {
        return badRequest("Informe um custo unitário válido para todas as variações");
      }

      await db.itemCostSheetComponent.update({
        where: { id: component.id },
        data: {
          name: isRefLine ? component.name : (name || "Custo"),
          notes: notes || null,
        },
      });
      for (const update of updates) {
        const baseUnitCostAmount = isRefLine
          ? Number(update.existingValue?.unitCostAmount || 0)
          : update.unitCostAmount;

        if (update.existingValue?.id) {
          await db.itemCostSheetVariationComponent.update({
            where: { id: update.existingValue.id },
            data: {
              unit: isRefLine ? update.existingValue.unit : (update.unitRaw || null),
              quantity: update.quantity,
              unitCostAmount: baseUnitCostAmount,
              wastePerc: update.wastePerc,
              totalCostAmount: calcItemCostSheetTotalCostAmount(
                baseUnitCostAmount,
                update.quantity,
                update.wastePerc
              ),
            },
          });
        } else {
          await db.itemCostSheetVariationComponent.create({
            data: {
              itemCostSheetComponentId: component.id,
              itemVariationId: update.itemVariationId,
              unit: update.unitRaw || null,
              quantity: update.quantity,
              unitCostAmount: baseUnitCostAmount,
              wastePerc: update.wastePerc,
              totalCostAmount: calcItemCostSheetTotalCostAmount(
                baseUnitCostAmount,
                update.quantity,
                update.wastePerc
              ),
            },
          });
        }
      }
      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-delete") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const component = await db.itemCostSheetComponent.findFirst({
        where: { id: lineId, itemCostSheetId: rootSheetId },
        select: { id: true },
      });
      if (!component) return badRequest("Linha não encontrada");
      await db.itemCostSheetComponent.delete({ where: { id: lineId } });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-delete") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      const deletionGuard = await getItemCostSheetDeletionGuard(db, {
        itemCostSheetId: rootSheetId,
        isActive: groupSheets.some((sheet: any) => Boolean(sheet.isActive)),
      });
      if (!deletionGuard.canDelete) return badRequest(deletionGuard.reason || "Não foi possível eliminar a ficha");

      await db.$transaction([
        db.itemCostSheet.deleteMany({ where: { baseItemCostSheetId: rootSheetId } }),
        db.itemCostSheet.delete({ where: { id: rootSheetId } }),
      ]);
      return redirect("/admin/item-cost-sheets");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export function SheetTypeLabel({ type }: { type: string }) {
  const className =
    type === "recipe"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : type === "recipeSheet"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : type === "item"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : type === "labor"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-100 text-slate-700";
  const label =
    type === "recipe"
      ? "receita"
      : type === "recipeSheet"
        ? "ficha"
        : type === "item"
          ? "item"
          : type === "labor"
            ? "mão de obra"
            : type;

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function variationLabel(sheet: any) {
  return sheet.ItemVariation?.Variation?.name || "Sem variacao";
}

export type AdminItemCostSheetDetailOutletContext = {
  item: { id: string; name: string } | null;
  variationSheets: any[];
  rootSheetId: string;
  selectedSheet: any | null;
  compositionRows: SheetCompositionRow[];
  recipeCompositionBreakdownByLineId: Record<
    string,
    Record<string, RecipeCompositionBreakdown>
  >;
  recipeOptions: Array<{
    id: string;
    name: string;
    type: string;
    variationLabel?: string | null;
  }>;
  referenceSheetOptions: Array<{
    id: string;
    name: string;
    itemId: string;
    costAmount: number;
  }>;
  packagingItemOptions: PackagingItemOption[];
  componentPresets: ComponentPresetRecord[];
  unitOptions: string[];
  recipeSheetDependencyCountById: Record<string, number>;
  deletionGuard: {
    canDelete?: boolean;
    reason?: string | null;
    referenceDependencyCount?: number;
    baseDependencyCount?: number;
  };
  totalsByVariationId: Record<string, number>;
  selectedSheetDependencyCount: number;
  recipeReferenceCount: number;
  sheetReferenceCount: number;
  operationalCostCount: number;
  totalComponents: number;
  totalSheetCost: number;
  detailPath: string;
  actionData: any;
};

export default function AdminItemCostSheetDetail() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const location = useLocation();
  const payload = loaderData?.payload || {};
  const item = payload.item as { id: string; name: string } | null;
  const variationSheets = (payload.variationSheets || []) as any[];
  const rootSheetId = String(payload.rootSheetId || "");
  const selectedSheet = payload.selectedSheet as any | null;
  const compositionRows = (payload.compositionRows || []) as SheetCompositionRow[];
  const recipeCompositionBreakdownByLineId = (payload.recipeCompositionBreakdownByLineId || {}) as Record<
    string,
    Record<string, RecipeCompositionBreakdown>
  >;
  const recipeOptions = (payload.recipeOptions || []) as Array<{
    id: string;
    name: string;
    type: string;
    variationLabel?: string | null;
  }>;
  const referenceSheetOptions = (payload.referenceSheetOptions || []) as Array<{
    id: string;
    name: string;
    itemId: string;
    costAmount: number;
  }>;
  const packagingItemOptions = (payload.packagingItemOptions || []) as PackagingItemOption[];
  const componentPresets = (payload.componentPresets || []) as ComponentPresetRecord[];
  const unitOptions = (payload.unitOptions || ITEM_UNIT_OPTIONS) as string[];
  const recipeSheetDependencyCountById = (payload.recipeSheetDependencyCountById || {}) as Record<string, number>;
  const deletionGuard = (payload.deletionGuard || {}) as {
    canDelete?: boolean;
    reason?: string | null;
    referenceDependencyCount?: number;
    baseDependencyCount?: number;
  };
  const totalsByVariationId = Object.fromEntries(
    variationSheets.map((sheet) => {
      const total = compositionRows.reduce((acc, line) => {
        const value = line.variationValues.find((row) => row.itemVariationId === sheet.itemVariationId);
        return acc + Number(value?.totalCostAmount || 0);
      }, 0);
      return [String(sheet.itemVariationId), total];
    })
  ) as Record<string, number>;
  const selectedSheetDependencyCount = Number(recipeSheetDependencyCountById[rootSheetId || selectedSheet?.id || ""] || 0);
  const recipeReferenceCount = compositionRows.filter((line) => line.type === "recipe").length;
  const sheetReferenceCount = compositionRows.filter((line) => line.type === "recipeSheet").length;
  const operationalCostCount = compositionRows.filter((line) => line.type === "manual" || line.type === "labor").length;
  const totalComponents = compositionRows.length;
  const totalSheetCost = variationSheets.reduce(
    (acc, sheet) => acc + Number(totalsByVariationId[String(sheet.itemVariationId)] || 0),
    0
  );
  const detailPath = sheetDetailHref(selectedSheet?.id || rootSheetId);
  const infoTabs = [
    { href: "dados-gerais", label: "dados gerais" },
    { href: "custos", label: "custos" },
    { href: "outros", label: "outros" },
  ];

  const outletContext: AdminItemCostSheetDetailOutletContext = {
    item,
    variationSheets,
    rootSheetId,
    selectedSheet,
    compositionRows,
    recipeCompositionBreakdownByLineId,
    recipeOptions,
    referenceSheetOptions,
    packagingItemOptions,
    componentPresets,
    unitOptions,
    recipeSheetDependencyCountById,
    deletionGuard,
    totalsByVariationId,
    selectedSheetDependencyCount,
    recipeReferenceCount,
    sheetReferenceCount,
    operationalCostCount,
    totalComponents,
    totalSheetCost,
    detailPath,
    actionData,
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6 bg-white pb-20  md:pb-24">

      <div className="space-y-3">
        <div>
          <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950">
            {selectedSheet?.name || item?.name || "Ficha de custo"}
          </h2>
          {item ? (
            <Link to={`/admin/items/${item.id}/main`} className="mt-1 inline-flex text-sm text-slate-500 transition hover:text-slate-900 hover:underline">
              {item.name}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Item</p>
          )}
        </div>
      </div>

      {actionData?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}

      {selectedSheet ? (
        <div className="space-y-6">
          <nav className="overflow-x-auto border-b border-slate-100">
            <div className="flex min-w-max items-center gap-6 text-sm">
              {infoTabs.map((tab) => {
                const isActive = location.pathname.endsWith(`/${tab.href}`);
                return (
                  <Link
                    key={tab.href}
                    to={tab.href}
                    className={`border-b-2 pb-3 font-medium transition ${isActive ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"
                      }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <Outlet context={outletContext} />
        </div>
      ) : null}
    </div>
  );
}
