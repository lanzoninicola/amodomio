import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useOutletContext } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import type { AdminItemOutletContext } from "./admin.items.$id";

type SheetCompositionRow = {
  id: string;
  componentId: string;
  variationComponentId: string | null;
  type: string;
  refId: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unitCostAmount: number;
  wastePerc: number;
  totalCostAmount: number;
  sortOrderIndex: number;
  notes: string | null;
  sourceModel: "component" | "legacy";
};

function supportsComponentModel(db: any) {
  return typeof db?.itemCostSheetComponent?.findMany === "function" &&
    typeof db?.itemCostSheetVariationComponent?.findMany === "function";
}

function roundMoney(value: number) {
  return Number(Number(value || 0).toFixed(6));
}

function calcTotalCostAmount(unitCostAmount: number, quantity: number, wastePerc: number) {
  const baseAmount = Number(unitCostAmount || 0) * Number(quantity || 0);
  const wasteFactor = 1 + (Number(wastePerc || 0) / 100);
  return roundMoney(baseAmount * wasteFactor);
}

async function getRecipeSnapshot(db: any, recipeId: string) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) throw new Error("Receita não encontrada");

  const lines = await listRecipeCompositionLines(db, recipeId);
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

async function getItemCostSheetSnapshot(db: any, itemCostSheetId: string) {
  const sheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: { id: true, name: true, costAmount: true },
  });
  if (!sheet) throw new Error("Ficha de custo não encontrada");

  return {
    sheet,
    unitCostAmount: Number(sheet.costAmount || 0),
    note: `snapshot ficha: total=${Number(sheet.costAmount || 0).toFixed(4)}`,
  };
}

async function listItemCostSheetCompositionRows(
  db: any,
  params: { itemCostSheetId: string; itemVariationId: string }
): Promise<SheetCompositionRow[]> {
  if (supportsComponentModel(db)) {
    const components = await db.itemCostSheetComponent.findMany({
      where: { itemCostSheetId: params.itemCostSheetId },
      include: {
        ItemCostSheetVariationComponent: {
          where: { itemVariationId: params.itemVariationId },
          orderBy: [{ createdAt: "asc" }],
          take: 1,
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    });

    return components.map((component: any) => {
      const value = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent[0] || null
        : null;

      return {
        id: component.id,
        componentId: component.id,
        variationComponentId: value?.id || null,
        type: String(component.type || "manual"),
        refId: component.refId || null,
        name: component.name,
        unit: value?.unit || null,
        quantity: Number(value?.quantity || 0),
        unitCostAmount: Number(value?.unitCostAmount || 0),
        wastePerc: Number(value?.wastePerc || 0),
        totalCostAmount: Number(value?.totalCostAmount || 0),
        sortOrderIndex: Number(component.sortOrderIndex || 0),
        notes: component.notes || null,
        sourceModel: "component",
      };
    });
  }

  const lines = await db.itemCostSheetLine.findMany({
    where: { itemCostSheetId: params.itemCostSheetId },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });

  return (lines || []).map((line: any) => ({
    id: line.id,
    componentId: line.id,
    variationComponentId: null,
    type: String(line.type || "manual"),
    refId: line.refId || null,
    name: line.name,
    unit: line.unit || null,
    quantity: Number(line.quantity || 0),
    unitCostAmount: Number(line.unitCostAmount || 0),
    wastePerc: Number(line.wastePerc || 0),
    totalCostAmount: Number(line.totalCostAmount || 0),
    sortOrderIndex: Number(line.sortOrderIndex || 0),
    notes: line.notes || null,
    sourceModel: "legacy",
  }));
}

async function createItemCostSheetRow(params: {
  db: any;
  itemCostSheetId: string;
  itemVariationId: string;
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
    type,
    refId,
    name,
    unit,
    quantity,
    unitCostAmount,
    wastePerc,
    notes,
  } = params;

  if (supportsComponentModel(db)) {
    const lineCount = await db.itemCostSheetComponent.count({ where: { itemCostSheetId } });
    await db.itemCostSheetComponent.create({
      data: {
        itemCostSheetId,
        type,
        refId: refId || null,
        name,
        notes: notes || null,
        sortOrderIndex: Number(lineCount || 0),
        ItemCostSheetVariationComponent: {
          create: {
            itemVariationId,
            unit: unit || null,
            quantity,
            unitCostAmount,
            wastePerc,
            totalCostAmount: calcTotalCostAmount(unitCostAmount, quantity, wastePerc),
          },
        },
      },
    });
    return;
  }

  const lineCount = await db.itemCostSheetLine.count({ where: { itemCostSheetId } });
  await db.itemCostSheetLine.create({
    data: {
      itemCostSheetId,
      type,
      refId: refId || null,
      name,
      unit: unit || null,
      quantity,
      unitCostAmount,
      wastePerc,
      totalCostAmount: calcTotalCostAmount(unitCostAmount, quantity, wastePerc),
      sortOrderIndex: Number(lineCount || 0),
      notes: notes || null,
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

    const refs = supportsComponentModel(db)
      ? await db.itemCostSheetComponent.findMany({
        where: { itemCostSheetId: currentId, type: "recipeSheet" },
        select: { refId: true },
      })
      : await db.itemCostSheetLine.findMany({
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
    select: { id: true, itemVariationId: true },
  });
  if (!sheet) return;

  if (supportsComponentModel(db)) {
    const components = await db.itemCostSheetComponent.findMany({
      where: { itemCostSheetId },
      include: {
        ItemCostSheetVariationComponent: {
          where: { itemVariationId: sheet.itemVariationId },
          orderBy: [{ createdAt: "asc" }],
          take: 1,
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    });

    for (const component of components) {
      const value = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent[0] || null
        : null;
      if (!component.refId || !value?.id) continue;

      try {
        if (component.type === "recipe") {
          const snapshot = await getRecipeSnapshot(db, component.refId);
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
          if (component.refId === itemCostSheetId) continue;
          const snapshot = await getItemCostSheetSnapshot(db, component.refId);
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

    const refreshedComponents = await db.itemCostSheetComponent.findMany({
      where: { itemCostSheetId },
      include: {
        ItemCostSheetVariationComponent: {
          where: { itemVariationId: sheet.itemVariationId },
          orderBy: [{ createdAt: "asc" }],
          take: 1,
        },
      },
    });

    const totalAmount = refreshedComponents.reduce((acc: number, component: any) => {
      const value = Array.isArray(component.ItemCostSheetVariationComponent)
        ? component.ItemCostSheetVariationComponent[0] || null
        : null;
      return acc + Number(value?.totalCostAmount || 0);
    }, 0);

    await db.itemCostSheet.update({
      where: { id: itemCostSheetId },
      data: { costAmount: roundMoney(totalAmount) },
    });
    return;
  }

  const lines = await db.itemCostSheetLine.findMany({
    where: { itemCostSheetId },
    select: {
      id: true,
      type: true,
      refId: true,
      quantity: true,
      unitCostAmount: true,
      wastePerc: true,
    },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });

  for (const line of lines) {
    if (!line.refId) continue;
    try {
      if (line.type === "recipe") {
        const snapshot = await getRecipeSnapshot(db, line.refId);
        await db.itemCostSheetLine.update({
          where: { id: line.id },
          data: {
            unitCostAmount: roundMoney(snapshot.unitCostAmount),
            totalCostAmount: calcTotalCostAmount(snapshot.unitCostAmount, Number(line.quantity || 0), Number(line.wastePerc || 0)),
            notes: snapshot.note,
          },
        });
        continue;
      }

      if (line.type === "recipeSheet") {
        if (line.refId === itemCostSheetId) continue;
        const snapshot = await getItemCostSheetSnapshot(db, line.refId);
        await db.itemCostSheetLine.update({
          where: { id: line.id },
          data: {
            unitCostAmount: roundMoney(snapshot.unitCostAmount),
            totalCostAmount: calcTotalCostAmount(snapshot.unitCostAmount, Number(line.quantity || 0), Number(line.wastePerc || 0)),
            notes: snapshot.note,
          },
        });
      }
    } catch {
      // preserve manual values when reference is unavailable
    }
  }

  const totals = await db.itemCostSheetLine.aggregate({
    where: { itemCostSheetId },
    _sum: { totalCostAmount: true },
  });

  await db.itemCostSheet.update({
    where: { id: itemCostSheetId },
    data: { costAmount: roundMoney(Number(totals?._sum?.totalCostAmount || 0)) },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const itemId = String(params.id || "").trim();
    if (!itemId) return badRequest("Item inválido");

    const url = new URL(request.url);
    const itemCostSheetIdFromQuery = String(url.searchParams.get("itemCostSheetId") || "").trim();
    const db = prismaClient as any;

    const [recipeSheets, recipes, referenceSheets, recipeSheetDependencyAgg] = await Promise.all([
      db.itemCostSheet.findMany({
        where: { itemId },
        include: {
          ItemVariation: { include: { Variation: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
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
        where: { isActive: true },
        select: { id: true, name: true, itemId: true, costAmount: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 300,
      }),
      supportsComponentModel(db)
        ? db.itemCostSheetComponent.groupBy({
          by: ["refId"],
          where: { type: "recipeSheet", refId: { not: null } },
          _count: { _all: true },
        })
        : db.itemCostSheetLine.groupBy({
          by: ["refId"],
          where: { type: "recipeSheet", refId: { not: null } },
          _count: { _all: true },
        }),
    ]);

    const selectedSheet =
      recipeSheets.find((sheet: any) => sheet.id === itemCostSheetIdFromQuery) ||
      recipeSheets.find((sheet: any) => sheet.isActive) ||
      recipeSheets[0] ||
      null;

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

    const compositionRows = selectedSheet
      ? await listItemCostSheetCompositionRows(db, {
        itemCostSheetId: selectedSheet.id,
        itemVariationId: selectedSheet.itemVariationId,
      })
      : [];

    return ok({
      recipeSheets,
      selectedSheetId: selectedSheet?.id || null,
      selectedSheet,
      compositionRows,
      recipeOptions,
      referenceSheetOptions: referenceSheets,
      recipeSheetDependencyCountById,
      supportsComponentModel: supportsComponentModel(db),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = String(params.id || "").trim();
    if (!itemId) return badRequest("Item inválido");

    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");
    const db = prismaClient as any;

    if (_action === "item-cost-sheet-line-add-recipe") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const recipeId = String(formData.get("recipeId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!recipeId) return badRequest("Selecione a receita");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");

      const [sheet, snapshot] = await Promise.all([
        db.itemCostSheet.findFirst({
          where: { id: itemCostSheetId, itemId },
          select: { id: true, itemVariationId: true },
        }),
        getRecipeSnapshot(db, recipeId),
      ]);
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      await createItemCostSheetRow({
        db,
        itemCostSheetId,
        itemVariationId: sheet.itemVariationId,
        type: "recipe",
        refId: recipeId,
        name: snapshot.recipe.name,
        unit: "receita",
        quantity,
        unitCostAmount: roundMoney(snapshot.unitCostAmount),
        wastePerc,
        notes: snapshot.note,
      });

      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-add-manual") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = String(formData.get("unit") || "").trim() || null;
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!name) return badRequest("Informe o nome do custo");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const sheet = await db.itemCostSheet.findFirst({
        where: { id: itemCostSheetId, itemId },
        select: { id: true, itemVariationId: true },
      });
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      await createItemCostSheetRow({
        db,
        itemCostSheetId,
        itemVariationId: sheet.itemVariationId,
        type: "manual",
        name,
        unit,
        quantity,
        unitCostAmount,
        wastePerc,
        notes: notes || null,
      });

      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-add-labor") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim() || "Mão de obra";
      const unit = String(formData.get("unit") || "").trim() || "h";
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const sheet = await db.itemCostSheet.findFirst({
        where: { id: itemCostSheetId, itemId },
        select: { id: true, itemVariationId: true },
      });
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      await createItemCostSheetRow({
        db,
        itemCostSheetId,
        itemVariationId: sheet.itemVariationId,
        type: "labor",
        name,
        unit,
        quantity,
        unitCostAmount,
        wastePerc,
        notes: notes || null,
      });

      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
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

      const createsCycle = await wouldCreateRecipeSheetCycle(db, itemCostSheetId, refSheetId);
      if (createsCycle) return badRequest("Esta referência criaria ciclo entre fichas de custo");

      const [sheet, refSnapshot] = await Promise.all([
        db.itemCostSheet.findFirst({
          where: { id: itemCostSheetId, itemId },
          select: { id: true, itemVariationId: true },
        }),
        getItemCostSheetSnapshot(db, refSheetId),
      ]);
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      await createItemCostSheetRow({
        db,
        itemCostSheetId,
        itemVariationId: sheet.itemVariationId,
        type: "recipeSheet",
        refId: refSheetId,
        name: refSnapshot.sheet.name,
        unit: "ficha",
        quantity,
        unitCostAmount: roundMoney(refSnapshot.unitCostAmount),
        wastePerc,
        notes: refSnapshot.note,
      });

      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-move") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const direction = String(formData.get("direction") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");
      if (!["up", "down"].includes(direction)) return badRequest("Direção inválida");

      const rows = supportsComponentModel(db)
        ? await db.itemCostSheetComponent.findMany({
          where: { itemCostSheetId },
          select: { id: true, sortOrderIndex: true, createdAt: true },
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
        })
        : await db.itemCostSheetLine.findMany({
          where: { itemCostSheetId },
          select: { id: true, sortOrderIndex: true, createdAt: true },
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
        });

      const currentIndex = rows.findIndex((row: any) => row.id === lineId);
      if (currentIndex < 0) return badRequest("Linha não encontrada");

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) {
        return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
      }

      const current = rows[currentIndex];
      const target = rows[targetIndex];
      const model = supportsComponentModel(db) ? db.itemCostSheetComponent : db.itemCostSheetLine;

      await db.$transaction([
        model.update({
          where: { id: current.id },
          data: { sortOrderIndex: Number(target.sortOrderIndex || 0) },
        }),
        model.update({
          where: { id: target.id },
          data: { sortOrderIndex: Number(current.sortOrderIndex || 0) },
        }),
      ]);

      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-update") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unitRaw = String(formData.get("unit") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "0").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const sheet = await db.itemCostSheet.findFirst({
        where: { id: itemCostSheetId, itemId },
        select: { id: true, itemVariationId: true },
      });
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      if (supportsComponentModel(db)) {
        const component = await db.itemCostSheetComponent.findFirst({
          where: { id: lineId, itemCostSheetId },
          include: {
            ItemCostSheetVariationComponent: {
              where: { itemVariationId: sheet.itemVariationId },
              orderBy: [{ createdAt: "asc" }],
              take: 1,
            },
          },
        });
        if (!component) return badRequest("Linha não encontrada");

        const value = Array.isArray(component.ItemCostSheetVariationComponent)
          ? component.ItemCostSheetVariationComponent[0] || null
          : null;
        if (!value) return badRequest("Valor da linha não encontrado");

        const isRefLine = (component.type === "recipe" || component.type === "recipeSheet") && !!component.refId;
        await db.itemCostSheetComponent.update({
          where: { id: component.id },
          data: {
            name: isRefLine ? component.name : (name || "Custo"),
            notes: notes || null,
          },
        });
        await db.itemCostSheetVariationComponent.update({
          where: { id: value.id },
          data: {
            unit: isRefLine ? value.unit : (unitRaw || null),
            quantity,
            unitCostAmount: isRefLine ? value.unitCostAmount : unitCostAmount,
            wastePerc,
            totalCostAmount: calcTotalCostAmount(
              isRefLine ? Number(value.unitCostAmount || 0) : unitCostAmount,
              quantity,
              wastePerc
            ),
          },
        });
        await recalcItemCostSheetTotals(db, itemCostSheetId);
        return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
      }

      const line = await db.itemCostSheetLine.findFirst({
        where: { id: lineId, itemCostSheetId },
        select: { id: true, type: true, refId: true, unitCostAmount: true },
      });
      if (!line) return badRequest("Linha não encontrada");

      const isRefLine = (line.type === "recipe" || line.type === "recipeSheet") && !!line.refId;
      await db.itemCostSheetLine.update({
        where: { id: lineId },
        data: {
          name: isRefLine ? undefined : (name || "Custo"),
          unit: isRefLine ? undefined : (unitRaw || null),
          quantity,
          unitCostAmount: isRefLine ? Number(line.unitCostAmount || 0) : unitCostAmount,
          wastePerc,
          totalCostAmount: calcTotalCostAmount(
            isRefLine ? Number(line.unitCostAmount || 0) : unitCostAmount,
            quantity,
            wastePerc
          ),
          notes: notes || null,
        },
      });
      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-delete") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      if (!itemCostSheetId || !lineId) return badRequest("Linha inválida");

      if (supportsComponentModel(db)) {
        const component = await db.itemCostSheetComponent.findFirst({
          where: { id: lineId, itemCostSheetId },
          select: { id: true },
        });
        if (!component) return badRequest("Linha não encontrada");
        await db.itemCostSheetComponent.delete({ where: { id: lineId } });
      } else {
        const line = await db.itemCostSheetLine.findFirst({
          where: { id: lineId, itemCostSheetId },
          select: { id: true },
        });
        if (!line) return badRequest("Linha não encontrada");
        await db.itemCostSheetLine.delete({ where: { id: lineId } });
      }

      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    if (_action === "item-cost-sheet-line-recalc") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");
      await recalcItemCostSheetTotals(db, itemCostSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?itemCostSheetId=${itemCostSheetId}`);
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

function SheetTypeLabel({ type }: { type: string }) {
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

export default function AdminItemCostSheetsTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const recipeSheets = item.ItemCostSheet || [];
  const payload = loaderData?.payload || {};
  const recipeSheetRows = (payload.recipeSheets || []) as any[];
  const selectedSheetId = String(payload.selectedSheetId || "");
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
  const recipeSheetDependencyCountById = (payload.recipeSheetDependencyCountById || {}) as Record<string, number>;
  const totalFromLines = compositionRows.reduce((acc, line) => acc + Number(line.totalCostAmount || 0), 0);
  const selectedSheetDependencyCount = selectedSheet ? Number(recipeSheetDependencyCountById[selectedSheet.id] || 0) : 0;

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fichas técnicas de custo</h2>
          <p className="text-sm text-slate-600">{recipeSheets.length} ficha(s) vinculada(s) a este item</p>
        </div>
        <Button asChild type="button" className="rounded-lg">
          <Link to={`/admin/item-cost-sheets/new?itemId=${item.id}`}>Criar ficha de custo</Link>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {recipeSheets.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ficha de custo vinculada a este item.</p>
        ) : (
          recipeSheetRows.map((sheet: any) => (
            <div
              key={sheet.id}
              className={`rounded-xl border p-4 ${sheet.id === selectedSheetId ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{sheet.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {sheet.ItemVariation?.Variation?.name || "Sem variação"}
                    {recipeSheetDependencyCountById[sheet.id] ? ` • usada por ${recipeSheetDependencyCountById[sheet.id]} ficha(s)` : ""}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    sheet.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {sheet.isActive ? "Ativa" : "Rascunho"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Custo total</span>
                <span className="font-semibold text-slate-900">R$ {Number(sheet.costAmount || 0).toFixed(4)}</span>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  to={`?itemCostSheetId=${sheet.id}`}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Editar composição
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {actionData?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}

      {selectedSheet ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{selectedSheet.name}</div>
              <div className="mt-1 text-xs text-slate-500">{selectedSheet.ItemVariation?.Variation?.name || "Sem variação"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Composição</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{compositionRows.length}</div>
              <div className="text-xs text-slate-500">componentes</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custo total</div>
              <div className="mt-2 text-2xl font-black text-slate-900">R$ {Number(totalFromLines || selectedSheet.costAmount || 0).toFixed(4)}</div>
              <div className="text-xs text-slate-500">somatório da composição</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dependências</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{selectedSheetDependencyCount}</div>
              <div className="text-xs text-slate-500">fichas consumidoras</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Composição da ficha</h3>
              <p className="text-sm text-slate-700">
                Estrutura alinhada ao novo modelo de receitas: componente base + valores operacionais da variação.
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
              <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-recalc" className="rounded-lg">
                Recalcular ficha
              </Button>
            </Form>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar receita</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeId">Receita</label>
                <select id="recipeId" name="recipeId" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required>
                  <option value="">Selecionar receita</option>
                  {recipeOptions.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}{recipe.variationLabel ? ` (${recipe.variationLabel})` : ""} • méd R$ {recipe.avgTotal.toFixed(4)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeQuantity">Qtd</label>
                  <input id="recipeQuantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeWaste">Perda %</label>
                  <input id="recipeWaste" name="wastePerc" type="number" min="0" step="0.01" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-recipe">
                  Adicionar receita
                </Button>
              </div>
            </Form>

            <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar custo manual</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualName">Nome</label>
                <input id="manualName" name="name" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Ex.: Embalagem" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnit">Unidade</label>
                  <input id="manualUnit" name="unit" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="un / g / ml" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualQty">Qtd</label>
                  <input id="manualQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnitCost">Custo un.</label>
                  <input id="manualUnitCost" name="unitCostAmount" type="number" min="0" step="0.0001" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualWaste">Perda %</label>
                  <input id="manualWaste" name="wastePerc" type="number" min="0" step="0.01" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualNotes">Observação</label>
                <input id="manualNotes" name="notes" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-manual">
                  Adicionar custo
                </Button>
              </div>
            </Form>

            <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar mão de obra</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborName">Nome</label>
                <input id="laborName" name="name" defaultValue="Mão de obra" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnit">Unidade</label>
                  <input id="laborUnit" name="unit" defaultValue="h" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborQty">Qtd</label>
                  <input id="laborQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnitCost">Custo un.</label>
                  <input id="laborUnitCost" name="unitCostAmount" type="number" min="0" step="0.0001" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborWaste">Perda %</label>
                  <input id="laborWaste" name="wastePerc" type="number" min="0" step="0.01" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborNotes">Observação</label>
                <input id="laborNotes" name="notes" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-labor">
                  Adicionar mão de obra
                </Button>
              </div>
            </Form>

            <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar ficha referenciada</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refRecipeSheetId">Ficha referência</label>
                <select id="refRecipeSheetId" name="refRecipeSheetId" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required>
                  <option value="">Selecionar ficha</option>
                  {referenceSheetOptions
                    .filter((sheet) => sheet.id !== selectedSheet.id)
                    .map((sheet) => (
                      <option key={sheet.id} value={sheet.id}>
                        {sheet.name} • R$ {Number(sheet.costAmount || 0).toFixed(4)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetQty">Qtd</label>
                  <input id="refSheetQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetWaste">Perda %</label>
                  <input id="refSheetWaste" name="wastePerc" type="number" min="0" step="0.01" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-sheet">
                  Adicionar ficha
                </Button>
              </div>
            </Form>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Componente</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Custo un.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Perda %</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Obs.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {compositionRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">Nenhum componente na ficha.</td>
                  </tr>
                ) : (
                  compositionRows.map((line) => {
                    const refLocked = line.type === "recipe" || line.type === "recipeSheet";
                    return (
                      <tr key={line.id} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <SheetTypeLabel type={line.type} />
                            <div className="text-[11px] text-slate-400">
                              {line.sourceModel === "component" ? "novo modelo" : "legado"}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 min-w-[280px]">
                          <Form method="post" className="space-y-2">
                            <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input
                              name="name"
                              defaultValue={line.name}
                              readOnly={refLocked}
                              className={`h-9 w-full rounded border px-2 text-sm ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                            />
                            <div className="grid grid-cols-4 gap-2">
                              <input
                                name="unit"
                                defaultValue={line.unit || ""}
                                readOnly={refLocked}
                                className={`h-9 rounded border px-2 text-xs ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                              />
                              <input
                                name="quantity"
                                type="number"
                                min="0.0001"
                                step="0.0001"
                                defaultValue={Number(line.quantity || 0)}
                                className="h-9 rounded border border-slate-200 px-2 text-xs text-right"
                                required
                              />
                              <input
                                name="unitCostAmount"
                                type="number"
                                min="0"
                                step="0.0001"
                                defaultValue={Number(line.unitCostAmount || 0)}
                                readOnly={refLocked}
                                className={`h-9 rounded border px-2 text-xs text-right ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                                required
                              />
                              <input
                                name="wastePerc"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={Number(line.wastePerc || 0)}
                                className="h-9 rounded border border-slate-200 px-2 text-xs text-right"
                              />
                            </div>
                            <div className="flex gap-2">
                              <input
                                name="notes"
                                defaultValue={line.notes || ""}
                                className="h-9 flex-1 rounded border border-slate-200 px-2 text-xs"
                                placeholder="Observação"
                              />
                              <button
                                type="submit"
                                name="_action"
                                value="item-cost-sheet-line-update"
                                className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Salvar
                              </button>
                            </div>
                          </Form>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{line.unit || "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{Number(line.quantity || 0).toFixed(4)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">R$ {Number(line.unitCostAmount || 0).toFixed(4)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{Number(line.wastePerc || 0).toFixed(2)}%</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900 tabular-nums">R$ {Number(line.totalCostAmount || 0).toFixed(4)}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{line.notes || "-"}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Form method="post" className="inline">
                              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
                              <input type="hidden" name="lineId" value={line.id} />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                type="submit"
                                name="_action"
                                value="item-cost-sheet-line-move"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                title="Subir"
                              >
                                ↑
                              </button>
                            </Form>
                            <Form method="post" className="inline">
                              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
                              <input type="hidden" name="lineId" value={line.id} />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                type="submit"
                                name="_action"
                                value="item-cost-sheet-line-move"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                title="Descer"
                              >
                                ↓
                              </button>
                            </Form>
                            <Form method="post" className="inline">
                              <input type="hidden" name="itemCostSheetId" value={selectedSheet.id} />
                              <input type="hidden" name="lineId" value={line.id} />
                              <button
                                type="submit"
                                name="_action"
                                value="item-cost-sheet-line-delete"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Remover
                              </button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
