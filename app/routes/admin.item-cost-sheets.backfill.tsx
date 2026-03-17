import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";
import createUUID from "~/utils/uuid";

const TARGET_CATEGORY_NAME = "sabor pizza";
const TARGET_CLASSIFICATION = "produto_final";

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

  if (supportsComponentModel(db)) {
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

  if (supportsComponentModel(db)) {
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
          // preserva valores manuais quando a referência não estiver disponível
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
      // preserva valores manuais quando a referência não estiver disponível
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

async function findTargetCategory(db: any) {
  return await db.category.findFirst({
    where: {
      type: "item",
      name: { equals: TARGET_CATEGORY_NAME, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
}

async function buildStats(db: any) {
  const category = await findTargetCategory(db);
  if (!category) {
    return {
      categoryFound: false,
      categoryName: TARGET_CATEGORY_NAME,
      targetItems: 0,
      targetItemsWithRecipe: 0,
      targetItemsWithSheet: 0,
    };
  }

  const items = await db.item.findMany({
    where: {
      classification: TARGET_CLASSIFICATION,
      categoryId: category.id,
    },
    select: {
      id: true,
      Recipe: {
        select: { id: true },
      },
      ItemCostSheet: {
        select: { id: true },
      },
    },
  });

  return {
    categoryFound: true,
    categoryName: category.name,
    targetItems: items.length,
    targetItemsWithRecipe: items.filter((item: any) => item.Recipe.length > 0).length,
    targetItemsWithSheet: items.filter((item: any) => item.ItemCostSheet.length > 0).length,
  };
}

async function ensureLatestSheetGroupForItem(params: {
  db: any;
  itemId: string;
  itemName: string;
  targetVariations: any[];
  primaryVariation: any;
}) {
  const { db, itemId, itemName, targetVariations, primaryVariation } = params;
  const primaryVariationId = String(primaryVariation?.id || "");

  const currentRoot = primaryVariationId
    ? await db.itemCostSheet.findFirst({
      where: { itemId, itemVariationId: primaryVariationId },
      select: { id: true, version: true, baseItemCostSheetId: true },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    })
    : null;

  if (!currentRoot) {
    const rootSheetId = createUUID();
    const version = 1;
    const orderedVariations = [
      primaryVariation,
      ...targetVariations.filter((variation: any) => variation.id !== primaryVariation?.id),
    ].filter(Boolean);

    for (const itemVariation of orderedVariations) {
      const isRoot = itemVariation.id === primaryVariation.id;
      await db.itemCostSheet.create({
        data: {
          id: isRoot ? rootSheetId : createUUID(),
          itemId,
          itemVariationId: itemVariation.id,
          name: `Ficha tecnica ${itemName}`,
          version,
          status: "draft",
          isActive: false,
          baseItemCostSheetId: isRoot ? null : rootSheetId,
        },
      });
    }

    return {
      rootSheetId,
      createdGroup: true,
      version,
    };
  }

  const rootSheetId = currentRoot.baseItemCostSheetId || currentRoot.id;
  const existingSheets = await db.itemCostSheet.findMany({
    where: {
      OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }],
    },
    select: { id: true, itemVariationId: true },
  });
  const existingVariationIds = new Set(existingSheets.map((sheet: any) => String(sheet.itemVariationId || "")));

  for (const itemVariation of targetVariations) {
    if (existingVariationIds.has(String(itemVariation.id))) continue;
    await db.itemCostSheet.create({
      data: {
        id: createUUID(),
        itemId,
        itemVariationId: itemVariation.id,
        name: `Ficha tecnica ${itemName}`,
        version: Number(currentRoot.version || 1),
        status: "draft",
        isActive: false,
        baseItemCostSheetId: rootSheetId,
      },
    });
  }

  return {
    rootSheetId,
    createdGroup: false,
    version: Number(currentRoot.version || 1),
  };
}

async function runPizzaFlavorCostSheetBackfill() {
  const db = prismaClient as any;
  const category = await findTargetCategory(db);

  if (!category) {
    return {
      ok: false,
      reason: `Categoria '${TARGET_CATEGORY_NAME}' não encontrada.`,
    };
  }

  const items = await db.item.findMany({
    where: {
      classification: TARGET_CLASSIFICATION,
      categoryId: category.id,
    },
    select: {
      id: true,
      name: true,
      Recipe: {
        select: {
          id: true,
          name: true,
          type: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }],
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const summary = {
    categoryName: category.name,
    totalTargetItems: items.length,
    processedItems: 0,
    sheetGroupsCreated: 0,
    recipeRefsAdded: 0,
    skippedMissingRecipe: 0,
    skippedExistingRecipeRef: 0,
    skippedNonEmptySheet: 0,
    skippedMissingVariations: 0,
    errors: 0,
    missingRecipeItems: [] as string[],
    nonEmptySheetItems: [] as string[],
    errorItems: [] as string[],
  };

  for (const item of items) {
    try {
      const preferredRecipe =
        item.Recipe.find((recipe: any) => recipe.type === "pizzaTopping") ||
        item.Recipe[0] ||
        null;

      if (!preferredRecipe) {
        summary.skippedMissingRecipe += 1;
        summary.missingRecipeItems.push(item.name);
        continue;
      }

      const primaryVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(item.id, { ensureBaseIfMissing: true });
      const itemVariations = await itemVariationPrismaEntity.findManyByItemId(item.id);
      const targetVariations = itemVariations.length > 0 ? itemVariations : primaryVariation ? [primaryVariation] : [];

      if (targetVariations.length === 0 || !primaryVariation) {
        summary.skippedMissingVariations += 1;
        continue;
      }

      const ensuredGroup = await ensureLatestSheetGroupForItem({
        db,
        itemId: item.id,
        itemName: item.name,
        targetVariations,
        primaryVariation,
      });

      if (ensuredGroup.createdGroup) {
        summary.sheetGroupsCreated += 1;
      }

      const rootSheetId = ensuredGroup.rootSheetId;
      const targetItemVariationIds = targetVariations.map((variation: any) => String(variation.id || "")).filter(Boolean);

      const existingRecipeRef = supportsComponentModel(db)
        ? await db.itemCostSheetComponent.findFirst({
          where: { itemCostSheetId: rootSheetId, type: "recipe", refId: preferredRecipe.id },
          select: { id: true },
        })
        : await db.itemCostSheetLine.findFirst({
          where: { itemCostSheetId: rootSheetId, type: "recipe", refId: preferredRecipe.id },
          select: { id: true },
        });

      if (existingRecipeRef) {
        summary.skippedExistingRecipeRef += 1;
        continue;
      }

      const existingComponentCount = supportsComponentModel(db)
        ? await db.itemCostSheetComponent.count({ where: { itemCostSheetId: rootSheetId } })
        : await db.itemCostSheetLine.count({ where: { itemCostSheetId: rootSheetId } });

      if (existingComponentCount > 0) {
        summary.skippedNonEmptySheet += 1;
        summary.nonEmptySheetItems.push(item.name);
        continue;
      }

      const snapshot = await getRecipeSnapshot(db, preferredRecipe.id);
      const variationEntries = await Promise.all(
        targetItemVariationIds.map(async (targetItemVariationId) => {
          const perVariationSnapshot = await getRecipeSnapshot(db, preferredRecipe.id, targetItemVariationId);
          return {
            itemVariationId: targetItemVariationId,
            unit: "receita",
            quantity: 1,
            unitCostAmount: roundMoney(perVariationSnapshot.unitCostAmount),
            wastePerc: 0,
          };
        })
      );

      await createItemCostSheetRow({
        db,
        itemCostSheetId: rootSheetId,
        itemVariationId: String(primaryVariation.id),
        targetItemVariationIds,
        variationEntries,
        type: "recipe",
        refId: preferredRecipe.id,
        name: snapshot.recipe.name,
        unit: "receita",
        quantity: 1,
        unitCostAmount: roundMoney(snapshot.unitCostAmount),
        wastePerc: 0,
        notes: snapshot.note,
      });

      await recalcItemCostSheetTotals(db, rootSheetId);
      summary.recipeRefsAdded += 1;
      summary.processedItems += 1;
    } catch (error) {
      summary.errors += 1;
      summary.errorItems.push(`${item.name}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  return {
    ok: true,
    ...summary,
  };
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const stats = await buildStats(prismaClient as any);
    return ok({ stats });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({}: ActionFunctionArgs) {
  try {
    const result = await runPizzaFlavorCostSheetBackfill();
    if (!result.ok) {
      return serverError(result.reason || "Não foi possível executar o backfill");
    }
    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemCostSheetsBackfillPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if (actionData?.status === 200) {
    toast({
      title: "Ok",
      description: `Backfill concluído. Fichas preenchidas: ${actionData.payload?.recipeRefsAdded ?? 0}`,
    });
  }

  if (actionData?.status && actionData.status >= 400) {
    toast({
      title: "Erro",
      description: actionData.message,
      variant: "destructive",
    });
  }

  const stats = (loaderData?.payload as any)?.stats || {};

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">Backfill fichas de custo de sabores</h1>
        <p className="mt-1 text-sm text-slate-600">
          Preenche fichas de custo de itens `produto_final` da categoria `sabor pizza` adicionando a receita vinculada como referência.
        </p>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <div>Categoria encontrada: {stats.categoryFound ? stats.categoryName : "não"}</div>
          <div>Itens alvo: {stats.targetItems ?? 0}</div>
          <div>Itens com receita vinculada: {stats.targetItemsWithRecipe ?? 0}</div>
          <div>Itens com alguma ficha de custo: {stats.targetItemsWithSheet ?? 0}</div>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          O backfill só adiciona a referência da receita quando a ficha do item está vazia. Fichas já preenchidas são puladas para evitar duplicação.
        </div>
      </div>

      <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4">
        <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
          Executar backfill
        </Button>
      </Form>

      {actionData?.payload ? (
        <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          {JSON.stringify(actionData.payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
