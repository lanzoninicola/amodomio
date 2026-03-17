import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

type SheetCompositionRow = {
  id: string;
  componentId: string;
  type: string;
  refId: string | null;
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

function roundMoney(value: number) {
  return Number(Number(value || 0).toFixed(6));
}

function calcTotalCostAmount(unitCostAmount: number, quantity: number, wastePerc: number) {
  const baseAmount = Number(unitCostAmount || 0) * Number(quantity || 0);
  const wasteFactor = 1 + (Number(wastePerc || 0) / 100);
  return roundMoney(baseAmount * wasteFactor);
}

function normalizeUnit(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
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

async function getRecipeSnapshot(db: any, recipeId: string, itemVariationId?: string | null) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) throw new Error("Receita não encontrada");

  const lines = (await listRecipeCompositionLines(db, recipeId))
    .filter((line) => !itemVariationId || String(line.ItemVariation?.id || "") === String(itemVariationId));
  const lastTotal = lines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0);
  const avgTotal = lines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0);

  return {
    recipe,
    lastTotal,
    avgTotal,
    unitCostAmount: avgTotal,
    note: `snapshot receita: ultimo=${lastTotal.toFixed(4)} medio=${avgTotal.toFixed(4)}`,
  };
}

async function getItemCostSheetSnapshot(db: any, itemCostSheetId: string, itemVariationId?: string | null) {
  const requestedSheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: { id: true, name: true, costAmount: true, itemVariationId: true, baseItemCostSheetId: true },
  });
  if (!requestedSheet) throw new Error("Ficha de custo não encontrada");

  const rootSheetId = requestedSheet.baseItemCostSheetId || requestedSheet.id;
  let sheet = requestedSheet;

  if (itemVariationId) {
    const variationMatch = await db.itemCostSheet.findFirst({
      where: {
        itemVariationId,
        OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }],
      },
      select: { id: true, name: true, costAmount: true, itemVariationId: true, baseItemCostSheetId: true },
    });
    if (variationMatch) sheet = variationMatch;
  }

  return {
    sheet,
    unitCostAmount: Number(sheet.costAmount || 0),
    note: `snapshot ficha: total=${Number(sheet.costAmount || 0).toFixed(4)}`,
  };
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
          totalCostAmount: calcTotalCostAmount(entry.unitCostAmount, entry.quantity, entry.wastePerc),
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

async function recalcItemCostSheetTotals(db: any, itemCostSheetId: string) {
  const sheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: { id: true, itemVariationId: true, baseItemCostSheetId: true },
  });
  if (!sheet) return;

  const rootSheetId = sheet.baseItemCostSheetId || sheet.id;
  const groupSheets = await db.itemCostSheet.findMany({
    where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
    select: { id: true, itemVariationId: true },
    orderBy: [{ createdAt: "asc" }],
  });
  if (groupSheets.length === 0) return;

  const components = await db.itemCostSheetComponent.findMany({
    where: { itemCostSheetId: rootSheetId },
    include: {
      ItemCostSheetVariationComponent: {
        where: {
          itemVariationId: {
            in: groupSheets.map((groupSheet: any) => String(groupSheet.itemVariationId || "")).filter(Boolean),
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });

  for (const component of components) {
    const values = Array.isArray(component.ItemCostSheetVariationComponent)
      ? component.ItemCostSheetVariationComponent
      : [];
    if (!component.refId || values.length === 0) continue;

    for (const value of values) {
      try {
        if (component.type === "recipe") {
          const snapshot = await getRecipeSnapshot(db, component.refId, value.itemVariationId);
          await db.itemCostSheetVariationComponent.update({
            where: { id: value.id },
            data: {
              unitCostAmount: roundMoney(snapshot.unitCostAmount),
              totalCostAmount: calcTotalCostAmount(snapshot.unitCostAmount, Number(value.quantity || 0), Number(value.wastePerc || 0)),
            },
          });
          await db.itemCostSheetComponent.update({
            where: { id: component.id },
            data: { notes: snapshot.note },
          });
          continue;
        }

        if (component.type === "recipeSheet") {
          if (component.refId === rootSheetId) continue;
          const snapshot = await getItemCostSheetSnapshot(db, component.refId, value.itemVariationId);
          await db.itemCostSheetVariationComponent.update({
            where: { id: value.id },
            data: {
              unitCostAmount: roundMoney(snapshot.unitCostAmount),
              totalCostAmount: calcTotalCostAmount(snapshot.unitCostAmount, Number(value.quantity || 0), Number(value.wastePerc || 0)),
            },
          });
          await db.itemCostSheetComponent.update({
            where: { id: component.id },
            data: { notes: snapshot.note },
          });
        }
      } catch {
        // preserve manual values when reference is unavailable
      }
    }
  }

  const refreshedComponents = await db.itemCostSheetComponent.findMany({
    where: { itemCostSheetId: rootSheetId },
    include: {
      ItemCostSheetVariationComponent: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  for (const groupSheet of groupSheets) {
    const totalAmount = refreshedComponents.reduce((acc: number, component: any) => {
      const value = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent.find((row: any) => row.itemVariationId === groupSheet.itemVariationId) || null
        : null;
      return acc + Number(value?.totalCostAmount || 0);
    }, 0);

    await db.itemCostSheet.update({
      where: { id: groupSheet.id },
      data: { costAmount: roundMoney(totalAmount) },
    });
  }
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

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemCostSheetId = String(params.id || "").trim();
    if (!itemCostSheetId) return badRequest("Ficha de custo inválida");

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

    const [recipeSheets, recipes, referenceSheets, recipeSheetDependencyAgg, unitOptions, activeItemVariationIds] = await Promise.all([
      db.itemCostSheet.findMany({
        where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
        include: {
          ItemVariation: { include: { Variation: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.recipe.findMany({
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
      }),
      db.itemCostSheet.findMany({
        where: { isActive: true, baseItemCostSheetId: null },
        select: { id: true, name: true, itemId: true, costAmount: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 300,
      }),
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

    const recipeOptions = await Promise.all(
      recipes.map(async (recipe: any) => {
        const lines = await listRecipeCompositionLines(db, recipe.id);
        const lastTotal = lines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0);
        const avgTotal = lines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0);
        return {
          id: recipe.id,
          name: recipe.name,
          type: recipe.type,
          variationLabel: recipe.Variation?.name || null,
          lastTotal,
          avgTotal,
        };
      })
    );

    const recipeSheetDependencyCountById = Object.fromEntries(
      (recipeSheetDependencyAgg || [])
        .filter((row: any) => row.refId)
        .map((row: any) => [String(row.refId), Number(row?._count?._all || 0)])
    );

    const compositionRows = await listItemCostSheetCompositionRows(db, {
      itemCostSheetId: rootSheetId,
      itemVariationIds: visibleRecipeSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean),
    });
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
      recipeOptions,
      referenceSheetOptions: referenceSheets,
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
        select: { id: true, itemVariationId: true, isActive: true },
        orderBy: [{ createdAt: "asc" }],
      }),
      listActiveItemVariationIdsForItem(db, currentSheet.itemId),
    ]);
    const availableUnits = await getAvailableItemUnits();
    const activeVariationIdSet = new Set(activeItemVariationIds);
    const visibleGroupSheets = groupSheets.filter((sheet: any) =>
      activeVariationIdSet.size === 0 || activeVariationIdSet.has(String(sheet.itemVariationId || ""))
    );
    const targetItemVariationIds = visibleGroupSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean);

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

      const snapshot = await getRecipeSnapshot(db, recipeId);
      const variationEntries = await Promise.all(
        targetItemVariationIds.map(async (targetItemVariationId) => {
          const perVariationSnapshot = await getRecipeSnapshot(db, recipeId, targetItemVariationId);
          return {
            itemVariationId: targetItemVariationId,
            unit: "receita",
            quantity,
            unitCostAmount: roundMoney(perVariationSnapshot.unitCostAmount),
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
        unitCostAmount: roundMoney(snapshot.unitCostAmount),
        wastePerc,
        notes: snapshot.note,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      return redirect(postRedirectTo);
    }

    if (_action === "item-cost-sheet-line-add-manual") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = normalizeUnit(formData.get("unit"));
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!name) return badRequest("Informe o nome do custo");
      if (!unit || !availableUnits.includes(unit)) return badRequest("Informe uma unidade válida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        type: "manual",
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
      const name = String(formData.get("name") || "").trim() || "Mão de obra";
      const unit = normalizeUnit(formData.get("unit"));
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!unit || !availableUnits.includes(unit)) return badRequest("Informe uma unidade válida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: currentSheet.itemVariationId,
        targetItemVariationIds,
        type: "labor",
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
            unitCostAmount: roundMoney(perVariationSnapshot.unitCostAmount),
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
        unitCostAmount: roundMoney(refSnapshot.unitCostAmount),
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

      const isRefLine = (component.type === "recipe" || component.type === "recipeSheet") && !!component.refId;
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
              totalCostAmount: calcTotalCostAmount(
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
              totalCostAmount: calcTotalCostAmount(
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

    if (_action === "item-cost-sheet-line-recalc") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (itemCostSheetId !== currentSheet.id) return badRequest("Ficha de custo divergente");
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
        : type === "labor"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {type}
    </span>
  );
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
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
  recipeOptions: Array<{
    id: string;
    name: string;
    type: string;
    variationLabel?: string | null;
    lastTotal: number;
    avgTotal: number;
  }>;
  referenceSheetOptions: Array<{
    id: string;
    name: string;
    itemId: string;
    costAmount: number;
  }>;
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
  const recipeOptions = (payload.recipeOptions || []) as Array<{
    id: string;
    name: string;
    type: string;
    variationLabel?: string | null;
    lastTotal: number;
    avgTotal: number;
  }>;
  const referenceSheetOptions = (payload.referenceSheetOptions || []) as Array<{
    id: string;
    name: string;
    itemId: string;
    costAmount: number;
  }>;
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
    recipeOptions,
    referenceSheetOptions,
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
    <div className="min-h-[calc(100vh-8rem)] space-y-6 bg-white p-4 pb-20  md:pb-24">

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
