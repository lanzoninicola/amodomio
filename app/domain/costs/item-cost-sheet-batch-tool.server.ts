import {
  calcItemCostSheetTotalCostAmount,
  getItemCostSheetSnapshot,
  getRecipeCompositionCostSnapshot,
  recalcItemCostSheetTotals,
  roundItemCostSheetMoney,
} from "~/domain/costs/item-cost-sheet-recalc.server";
import prismaClient from "~/lib/prisma/client.server";

export type BatchComponentType = "recipe" | "recipeSheet" | "manual" | "labor";

export type BatchSheetOption = {
  id: string;
  name: string;
  itemId: string;
  itemName: string;
  categoryName: string | null;
  isActive: boolean;
  variationCount: number;
  componentCount: number;
  updatedAt: Date;
};

export type BatchItemOption = {
  id: string;
  name: string;
  categoryName: string | null;
  sheetCount: number;
};

export type BatchToolOptions = {
  items: BatchItemOption[];
  rootSheets: BatchSheetOption[];
  recipes: Array<{ id: string; name: string; itemName: string | null }>;
  referenceSheets: BatchSheetOption[];
  presets: Array<{
    id: string;
    type: BatchComponentType;
    name: string;
    unit: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
    notes: string | null;
  }>;
  unitOptions: string[];
};

export type BatchMutationResult = {
  processed: number;
  changed: number;
  skipped: number;
  errors: number;
  rows: Array<{
    rootSheetId: string;
    sheetName: string;
    itemName: string;
    status: "changed" | "skipped" | "error";
    message: string;
  }>;
};

const STATIC_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

function normalizeUnit(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function parseNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? fallback).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function getAvailableItemUnits(db: any) {
  const units = new Set(STATIC_UNIT_OPTIONS);
  if (typeof db.measurementUnit?.findMany !== "function") {
    return Array.from(units).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    const rows = await db.measurementUnit.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    });
    for (const row of rows || []) {
      const code = normalizeUnit(row?.code);
      if (code) units.add(code);
    }
  } catch {
    // Measurement units may be absent in older restored databases.
  }

  return Array.from(units).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function getRootSheetGroup(db: any, rootSheetId: string) {
  const root = await db.itemCostSheet.findUnique({
    where: { id: rootSheetId },
    include: {
      Item: { select: { id: true, name: true } },
      ItemVariation: {
        select: {
          id: true,
          deletedAt: true,
          Variation: { select: { name: true, code: true } },
        },
      },
    },
  });
  if (!root) throw new Error("Ficha raiz não encontrada");
  const resolvedRootId = root.baseItemCostSheetId || root.id;
  if (resolvedRootId !== rootSheetId) throw new Error("Selecione a ficha raiz do grupo");

  const sheets = await db.itemCostSheet.findMany({
    where: { OR: [{ id: resolvedRootId }, { baseItemCostSheetId: resolvedRootId }] },
    include: {
      Item: { select: { id: true, name: true } },
      ItemVariation: {
        select: {
          id: true,
          deletedAt: true,
          Variation: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const activeSheets = sheets.filter((sheet: any) => !sheet.ItemVariation?.deletedAt);
  const itemVariationIds = activeSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean);

  return {
    root,
    sheets: activeSheets,
    itemVariationIds: unique(itemVariationIds),
  };
}

async function createComponentRow(params: {
  db: any;
  rootSheetId: string;
  type: BatchComponentType;
  refId?: string | null;
  presetId?: string | null;
  name: string;
  notes?: string | null;
  variationEntries: Array<{
    itemVariationId: string;
    unit: string | null;
    quantity: number;
    unitCostAmount: number;
    wastePerc: number;
  }>;
}) {
  const lineCount = await params.db.itemCostSheetComponent.count({
    where: { itemCostSheetId: params.rootSheetId },
  });

  await params.db.itemCostSheetComponent.create({
    data: {
      itemCostSheetId: params.rootSheetId,
      type: params.type,
      refId: params.refId || null,
      presetId: params.presetId || null,
      name: params.name,
      notes: params.notes || null,
      sortOrderIndex: Number(lineCount || 0),
      ItemCostSheetVariationComponent: {
        create: params.variationEntries.map((entry) => ({
          itemVariationId: entry.itemVariationId,
          unit: entry.unit,
          quantity: entry.quantity,
          unitCostAmount: entry.unitCostAmount,
          wastePerc: entry.wastePerc,
          totalCostAmount: calcItemCostSheetTotalCostAmount(
            entry.unitCostAmount,
            entry.quantity,
            entry.wastePerc
          ),
        })),
      },
    },
  });
}

async function wouldCreateRecipeSheetCycle(db: any, sourceRootSheetId: string, targetRootSheetId: string) {
  if (!sourceRootSheetId || !targetRootSheetId) return false;
  if (sourceRootSheetId === targetRootSheetId) return true;

  const visited = new Set<string>();
  const stack = [targetRootSheetId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (current === sourceRootSheetId) return true;

    const refs = await db.itemCostSheetComponent.findMany({
      where: { itemCostSheetId: current, type: "recipeSheet" },
      select: { refId: true },
    });
    for (const ref of refs || []) {
      const next = String(ref.refId || "").trim();
      if (next && !visited.has(next)) stack.push(next);
    }
  }

  return false;
}

async function buildRootSheetOptions(db: any): Promise<BatchSheetOption[]> {
  const rows = await db.itemCostSheet.findMany({
    where: { baseItemCostSheetId: null },
    include: {
      Item: {
        select: {
          id: true,
          name: true,
          Category: { select: { name: true } },
        },
      },
      _count: { select: { derivedItemCostSheet: true, ItemCostSheetComponent: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });

  return (rows || []).map((sheet: any) => ({
    id: String(sheet.id || ""),
    name: String(sheet.name || ""),
    itemId: String(sheet.itemId || ""),
    itemName: String(sheet.Item?.name || "Item desconhecido"),
    categoryName: sheet.Item?.Category?.name || null,
    isActive: Boolean(sheet.isActive),
    variationCount: Number(sheet._count?.derivedItemCostSheet || 0) + 1,
    componentCount: Number(sheet._count?.ItemCostSheetComponent || 0),
    updatedAt: sheet.updatedAt,
  }));
}

export async function getItemCostSheetBatchToolOptions(): Promise<BatchToolOptions> {
  const db = prismaClient as any;
  const [rootSheets, recipes, presets, unitOptions] = await Promise.all([
    buildRootSheetOptions(db),
    db.recipe.findMany({
      select: { id: true, name: true, Item: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
      take: 500,
    }),
    db.itemCostSheetComponentPreset.findMany({
      where: { active: true, type: { in: ["manual", "labor"] } },
      select: {
        id: true,
        type: true,
        name: true,
        unit: true,
        quantity: true,
        unitCostAmount: true,
        wastePerc: true,
        notes: true,
      },
      orderBy: [{ type: "asc" }, { sortOrderIndex: "asc" }, { name: "asc" }],
    }),
    getAvailableItemUnits(db),
  ]);

  const itemMap = new Map<string, BatchItemOption>();
  for (const sheet of rootSheets) {
    const existing = itemMap.get(sheet.itemId);
    if (existing) {
      existing.sheetCount += 1;
      continue;
    }
    itemMap.set(sheet.itemId, {
      id: sheet.itemId,
      name: sheet.itemName,
      categoryName: sheet.categoryName,
      sheetCount: 1,
    });
  }

  return {
    items: Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    rootSheets,
    recipes: (recipes || []).map((recipe: any) => ({
      id: String(recipe.id || ""),
      name: String(recipe.name || ""),
      itemName: recipe.Item?.name || null,
    })),
    referenceSheets: rootSheets,
    presets: (presets || []).map((preset: any) => ({
      id: String(preset.id || ""),
      type: String(preset.type || "manual") as BatchComponentType,
      name: String(preset.name || ""),
      unit: preset.unit || null,
      quantity: Number(preset.quantity || 1),
      unitCostAmount: Number(preset.unitCostAmount || 0),
      wastePerc: Number(preset.wastePerc || 0),
      notes: preset.notes || null,
    })),
    unitOptions,
  };
}

export function resolveTargetSheets(params: {
  rootSheets: BatchSheetOption[];
  sourceKind: string;
  itemId?: string | null;
  rootSheetId?: string | null;
}) {
  const sourceKind = params.sourceKind === "item" ? "item" : "sheet";
  if (sourceKind === "item") {
    const itemId = String(params.itemId || "").trim();
    return itemId ? params.rootSheets.filter((sheet) => sheet.itemId === itemId) : [];
  }

  const rootSheetId = String(params.rootSheetId || "").trim();
  return rootSheetId ? params.rootSheets.filter((sheet) => sheet.id === rootSheetId) : [];
}

export async function addComponentToItemCostSheets(params: {
  rootSheetIds: string[];
  componentType: BatchComponentType;
  recipeId?: string | null;
  refSheetId?: string | null;
  presetId?: string | null;
  name?: string | null;
  unit?: string | null;
  quantity?: unknown;
  unitCostAmount?: unknown;
  wastePerc?: unknown;
  notes?: string | null;
}): Promise<BatchMutationResult> {
  const db = prismaClient as any;
  const rootSheetIds = unique(params.rootSheetIds);
  const quantity = parseNumber(params.quantity, 1);
  const wastePerc = parseNumber(params.wastePerc, 0);
  const unitCostAmount = parseNumber(params.unitCostAmount, 0);
  const unit = normalizeUnit(params.unit);
  const notes = String(params.notes || "").trim() || null;
  const rows: BatchMutationResult["rows"] = [];

  if (rootSheetIds.length === 0) throw new Error("Selecione ao menos uma ficha");
  if (!(quantity > 0)) throw new Error("Informe uma quantidade válida");
  if (!(unitCostAmount >= 0)) throw new Error("Informe um custo unitário válido");

  let preset: any = null;
  if (params.presetId && (params.componentType === "manual" || params.componentType === "labor")) {
    preset = await db.itemCostSheetComponentPreset.findFirst({
      where: { id: params.presetId, active: true, type: params.componentType },
    });
    if (!preset) throw new Error("Preset inválido para o tipo selecionado");
  }

  for (const rootSheetId of rootSheetIds) {
    let sheetName = rootSheetId;
    let itemName = "";
    try {
      const group = await getRootSheetGroup(db, rootSheetId);
      sheetName = group.root.name;
      itemName = group.root.Item?.name || "";

      if (params.componentType === "recipe") {
        const recipeId = String(params.recipeId || "").trim();
        if (!recipeId) throw new Error("Selecione a receita");

        const existing = await db.itemCostSheetComponent.findFirst({
          where: { itemCostSheetId: rootSheetId, type: "recipe", refId: recipeId },
          select: { id: true },
        });
        if (existing) {
          rows.push({ rootSheetId, sheetName, itemName, status: "skipped", message: "Receita já existe na ficha" });
          continue;
        }

        const snapshot = await getRecipeCompositionCostSnapshot(db, recipeId);
        const variationEntries = await Promise.all(
          group.itemVariationIds.map(async (itemVariationId) => {
            const perVariation = await getRecipeCompositionCostSnapshot(db, recipeId, itemVariationId);
            return {
              itemVariationId,
              unit: "receita",
              quantity,
              unitCostAmount: roundItemCostSheetMoney(perVariation.unitCostAmount),
              wastePerc,
            };
          })
        );

        await createComponentRow({
          db,
          rootSheetId,
          type: "recipe",
          refId: recipeId,
          name: snapshot.recipe.name,
          notes: snapshot.note,
          variationEntries,
        });
      }

      if (params.componentType === "recipeSheet") {
        const refSheetId = String(params.refSheetId || "").trim();
        if (!refSheetId) throw new Error("Selecione a ficha de referência");
        if (refSheetId === rootSheetId) throw new Error("Não é permitido referenciar a própria ficha");
        if (await wouldCreateRecipeSheetCycle(db, rootSheetId, refSheetId)) {
          throw new Error("Esta referência criaria ciclo entre fichas");
        }

        const existing = await db.itemCostSheetComponent.findFirst({
          where: { itemCostSheetId: rootSheetId, type: "recipeSheet", refId: refSheetId },
          select: { id: true },
        });
        if (existing) {
          rows.push({ rootSheetId, sheetName, itemName, status: "skipped", message: "Ficha referenciada já existe na composição" });
          continue;
        }

        const snapshot = await getItemCostSheetSnapshot(db, refSheetId, group.root.itemVariationId);
        const variationEntries = await Promise.all(
          group.itemVariationIds.map(async (itemVariationId) => {
            const perVariation = await getItemCostSheetSnapshot(db, refSheetId, itemVariationId);
            return {
              itemVariationId,
              unit: "ficha",
              quantity,
              unitCostAmount: roundItemCostSheetMoney(perVariation.unitCostAmount),
              wastePerc,
            };
          })
        );

        await createComponentRow({
          db,
          rootSheetId,
          type: "recipeSheet",
          refId: refSheetId,
          name: snapshot.sheet.name,
          notes: snapshot.note,
          variationEntries,
        });
      }

      if (params.componentType === "manual" || params.componentType === "labor") {
        const name = String(params.name || preset?.name || (params.componentType === "labor" ? "Mão de obra" : "")).trim();
        if (!name) throw new Error("Informe o nome do componente");
        const resolvedUnit = normalizeUnit(unit || preset?.unit);
        if (!resolvedUnit) throw new Error("Informe a unidade do componente");

        const existingWhere = preset
          ? { itemCostSheetId: rootSheetId, type: params.componentType, presetId: preset.id }
          : { itemCostSheetId: rootSheetId, type: params.componentType, name };
        const existing = await db.itemCostSheetComponent.findFirst({
          where: existingWhere,
          select: { id: true },
        });
        if (existing) {
          rows.push({ rootSheetId, sheetName, itemName, status: "skipped", message: "Componente já existe na ficha" });
          continue;
        }

        const resolvedQuantity = params.quantity == null && preset ? Number(preset.quantity || 1) : quantity;
        const resolvedUnitCost = params.unitCostAmount == null && preset ? Number(preset.unitCostAmount || 0) : unitCostAmount;
        const resolvedWaste = params.wastePerc == null && preset ? Number(preset.wastePerc || 0) : wastePerc;

        await createComponentRow({
          db,
          rootSheetId,
          type: params.componentType,
          presetId: preset?.id || null,
          name,
          notes: notes || preset?.notes || null,
          variationEntries: group.itemVariationIds.map((itemVariationId) => ({
            itemVariationId,
            unit: resolvedUnit,
            quantity: resolvedQuantity,
            unitCostAmount: resolvedUnitCost,
            wastePerc: resolvedWaste,
          })),
        });
      }

      await recalcItemCostSheetTotals(db, rootSheetId);
      rows.push({ rootSheetId, sheetName, itemName, status: "changed", message: "Componente adicionado e ficha recalculada" });
    } catch (error) {
      rows.push({
        rootSheetId,
        sheetName,
        itemName,
        status: "error",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  return summarizeBatchRows(rows);
}

export async function updateComponentsInItemCostSheets(params: {
  rootSheetIds: string[];
  componentType: BatchComponentType;
  recipeId?: string | null;
  refSheetId?: string | null;
  presetId?: string | null;
  currentName?: string | null;
  newName?: string | null;
  unit?: string | null;
  quantity?: unknown;
  unitCostAmount?: unknown;
  wastePerc?: unknown;
  notes?: string | null;
}): Promise<BatchMutationResult> {
  const db = prismaClient as any;
  const rootSheetIds = unique(params.rootSheetIds);
  const quantity = parseNumber(params.quantity, 1);
  const wastePerc = parseNumber(params.wastePerc, 0);
  const unitCostAmount = parseNumber(params.unitCostAmount, 0);
  const unit = normalizeUnit(params.unit);
  const notes = String(params.notes || "").trim();
  const rows: BatchMutationResult["rows"] = [];

  if (rootSheetIds.length === 0) throw new Error("Selecione ao menos uma ficha");
  if (!(quantity > 0)) throw new Error("Informe uma quantidade válida");
  if (!(unitCostAmount >= 0)) throw new Error("Informe um custo unitário válido");

  for (const rootSheetId of rootSheetIds) {
    let sheetName = rootSheetId;
    let itemName = "";
    try {
      const group = await getRootSheetGroup(db, rootSheetId);
      sheetName = group.root.name;
      itemName = group.root.Item?.name || "";

      const componentWhere: any = {
        itemCostSheetId: rootSheetId,
        type: params.componentType,
      };
      if (params.componentType === "recipe") componentWhere.refId = String(params.recipeId || "").trim();
      if (params.componentType === "recipeSheet") componentWhere.refId = String(params.refSheetId || "").trim();
      if (params.componentType === "manual" || params.componentType === "labor") {
        const presetId = String(params.presetId || "").trim();
        const currentName = String(params.currentName || "").trim();
        if (presetId) componentWhere.presetId = presetId;
        else if (currentName) componentWhere.name = currentName;
        else throw new Error("Informe o preset ou nome atual do componente");
      }

      if ((params.componentType === "recipe" || params.componentType === "recipeSheet") && !componentWhere.refId) {
        throw new Error("Selecione a referência do componente");
      }

      const components = await db.itemCostSheetComponent.findMany({
        where: componentWhere,
        include: { ItemCostSheetVariationComponent: true },
      });
      if (components.length === 0) {
        rows.push({ rootSheetId, sheetName, itemName, status: "skipped", message: "Componente não encontrado nesta ficha" });
        continue;
      }

      for (const component of components) {
        const isReference = (component.type === "recipe" || component.type === "recipeSheet") && component.refId;
        const nextName = isReference ? component.name : String(params.newName || component.name || "").trim();
        await db.itemCostSheetComponent.update({
          where: { id: component.id },
          data: {
            name: nextName || component.name,
            notes: notes || component.notes || null,
          },
        });

        for (const itemVariationId of group.itemVariationIds) {
          const existingValue = (component.ItemCostSheetVariationComponent || []).find(
            (value: any) => String(value.itemVariationId || "") === itemVariationId
          );
          let nextUnit = unit || existingValue?.unit || null;
          let nextUnitCost = unitCostAmount;

          if (isReference && component.type === "recipe") {
            const snapshot = await getRecipeCompositionCostSnapshot(db, String(component.refId), itemVariationId);
            nextUnit = "receita";
            nextUnitCost = roundItemCostSheetMoney(snapshot.unitCostAmount);
          } else if (isReference && component.type === "recipeSheet") {
            const snapshot = await getItemCostSheetSnapshot(db, String(component.refId), itemVariationId);
            nextUnit = "ficha";
            nextUnitCost = roundItemCostSheetMoney(snapshot.unitCostAmount);
          }

          const data = {
            unit: nextUnit,
            quantity,
            unitCostAmount: nextUnitCost,
            wastePerc,
            totalCostAmount: calcItemCostSheetTotalCostAmount(nextUnitCost, quantity, wastePerc),
          };

          if (existingValue?.id) {
            await db.itemCostSheetVariationComponent.update({
              where: { id: existingValue.id },
              data,
            });
          } else {
            await db.itemCostSheetVariationComponent.create({
              data: {
                itemCostSheetComponentId: component.id,
                itemVariationId,
                ...data,
              },
            });
          }
        }
      }

      await recalcItemCostSheetTotals(db, rootSheetId);
      rows.push({ rootSheetId, sheetName, itemName, status: "changed", message: `${components.length} componente(s) editado(s)` });
    } catch (error) {
      rows.push({
        rootSheetId,
        sheetName,
        itemName,
        status: "error",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  return summarizeBatchRows(rows);
}

function summarizeBatchRows(rows: BatchMutationResult["rows"]): BatchMutationResult {
  return {
    processed: rows.length,
    changed: rows.filter((row) => row.status === "changed").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    errors: rows.filter((row) => row.status === "error").length,
    rows,
  };
}
