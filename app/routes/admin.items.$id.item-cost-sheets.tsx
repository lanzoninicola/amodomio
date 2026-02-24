import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useOutletContext } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import type { AdminItemOutletContext } from "./admin.items.$id";

async function getRecipeSnapshot(db: any, recipeId: string) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true, RecipeLine: true },
  });
  if (!recipe) throw new Error("Receita não encontrada");

  const lines = Array.isArray(recipe.RecipeLine) ? recipe.RecipeLine : [];
  const lastTotal = lines.reduce((acc: number, line: any) => acc + Number(line.lastTotalCostAmount || 0), 0);
  const avgTotal = lines.reduce((acc: number, line: any) => acc + Number(line.avgTotalCostAmount || 0), 0);

  return {
    recipe,
    lastTotal,
    avgTotal,
    unitCostAmount: avgTotal, // ficha usa custo médio como base operacional
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

    const refs = await db.itemCostSheetLine.findMany({
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
  const lines = await db.itemCostSheetLine.findMany({
    where: { itemCostSheetId },
    select: { id: true, type: true, refId: true, quantity: true, unitCostAmount: true, totalCostAmount: true },
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
            unitCostAmount: Number(snapshot.unitCostAmount.toFixed(6)),
            totalCostAmount: Number((snapshot.unitCostAmount * Number(line.quantity || 0)).toFixed(6)),
            notes: snapshot.note,
          },
        });
        continue;
      }

      if (line.type === "recipeSheet") {
        if (line.refId === itemCostSheetId) continue; // avoid self recursion loop
        const snapshot = await getItemCostSheetSnapshot(db, line.refId);
        await db.itemCostSheetLine.update({
          where: { id: line.id },
          data: {
            unitCostAmount: Number(snapshot.unitCostAmount.toFixed(6)),
            totalCostAmount: Number((snapshot.unitCostAmount * Number(line.quantity || 0)).toFixed(6)),
            notes: snapshot.note,
          },
        });
      }
    } catch {
      // ignore missing recipe references; preserve manual values
    }
  }

  const totals = await db.itemCostSheetLine.aggregate({
    where: { itemCostSheetId },
    _sum: { totalCostAmount: true },
  });

  await db.itemCostSheet.update({
    where: { id: itemCostSheetId },
    data: { costAmount: Number(totals?._sum?.totalCostAmount || 0) },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const itemId = String(params.id || "").trim();
    if (!itemId) return badRequest("Item inválido");

    const url = new URL(request.url);
    const sheetId = String(url.searchParams.get("sheetId") || "").trim();
    const db = prismaClient as any;

    const [recipeSheets, recipes, referenceSheets, recipeSheetDependencyAgg] = await Promise.all([
      db.itemCostSheet.findMany({
        where: { itemId },
        include: {
          ItemVariation: { include: { Variation: true } },
          ItemCostSheetLine: { orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }] },
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
          RecipeLine: {
            select: {
              lastTotalCostAmount: true,
              avgTotalCostAmount: true,
            },
          },
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
      db.itemCostSheetLine.groupBy({
        by: ["refId"],
        where: { type: "recipeSheet", refId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const selectedSheet =
      recipeSheets.find((sheet: any) => sheet.id === sheetId) ||
      recipeSheets.find((sheet: any) => sheet.isActive) ||
      recipeSheets[0] ||
      null;

    const recipeOptions = recipes.map((recipe: any) => {
      const lastTotal = (recipe.RecipeLine || []).reduce((acc: number, line: any) => acc + Number(line.lastTotalCostAmount || 0), 0);
      const avgTotal = (recipe.RecipeLine || []).reduce((acc: number, line: any) => acc + Number(line.avgTotalCostAmount || 0), 0);
      return {
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        variationLabel: recipe.Variation?.name || null,
        lastTotal,
        avgTotal,
      };
    });

    const recipeSheetDependencyCountById = Object.fromEntries(
      (recipeSheetDependencyAgg || [])
        .filter((row: any) => row.refId)
        .map((row: any) => [String(row.refId), Number(row?._count?._all || 0)])
    );

    return ok({
      recipeSheets,
      selectedSheetId: selectedSheet?.id || null,
      recipeOptions,
      referenceSheetOptions: referenceSheets,
      recipeSheetDependencyCountById,
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
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const recipeId = String(formData.get("recipeId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      if (!recipeSheetId) return badRequest("Ficha de custo inválida");
      if (!recipeId) return badRequest("Selecione a receita");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");

      const [sheet, snapshot] = await Promise.all([
        db.itemCostSheet.findFirst({ where: { id: recipeSheetId, itemId }, select: { id: true } }),
        getRecipeSnapshot(db, recipeId),
      ]);
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      const lineCount = await db.itemCostSheetLine.count({ where: { itemCostSheetId: recipeSheetId } });
      await db.itemCostSheetLine.create({
        data: {
          itemCostSheetId: recipeSheetId,
          type: "recipe",
          refId: recipeId,
          name: snapshot.recipe.name,
          unit: "receita",
          quantity,
          unitCostAmount: Number(snapshot.unitCostAmount.toFixed(6)),
          totalCostAmount: Number((snapshot.unitCostAmount * quantity).toFixed(6)),
          sortOrderIndex: Number(lineCount || 0),
          notes: snapshot.note,
        },
      });

      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-add-manual") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = String(formData.get("unit") || "").trim() || null;
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!recipeSheetId) return badRequest("Ficha de custo inválida");
      if (!name) return badRequest("Informe o nome do custo");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const sheet = await db.itemCostSheet.findFirst({ where: { id: recipeSheetId, itemId }, select: { id: true } });
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      const lineCount = await db.itemCostSheetLine.count({ where: { itemCostSheetId: recipeSheetId } });
      await db.itemCostSheetLine.create({
        data: {
          itemCostSheetId: recipeSheetId,
          type: "manual",
          name,
          unit,
          quantity,
          unitCostAmount,
          totalCostAmount: Number((unitCostAmount * quantity).toFixed(6)),
          sortOrderIndex: Number(lineCount || 0),
          notes: notes || null,
        },
      });

      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-add-labor") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const name = String(formData.get("name") || "").trim() || "Mão de obra";
      const unit = String(formData.get("unit") || "").trim() || "h";
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();

      if (!recipeSheetId) return badRequest("Ficha de custo inválida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const sheet = await db.itemCostSheet.findFirst({ where: { id: recipeSheetId, itemId }, select: { id: true } });
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      const lineCount = await db.itemCostSheetLine.count({ where: { itemCostSheetId: recipeSheetId } });
      await db.itemCostSheetLine.create({
        data: {
          itemCostSheetId: recipeSheetId,
          type: "labor",
          name,
          unit,
          quantity,
          unitCostAmount,
          totalCostAmount: Number((unitCostAmount * quantity).toFixed(6)),
          sortOrderIndex: Number(lineCount || 0),
          notes: notes || null,
        },
      });
      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-add-sheet") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const refSheetId = String(formData.get("refRecipeSheetId") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
      if (!recipeSheetId) return badRequest("Ficha de custo inválida");
      if (!refSheetId) return badRequest("Selecione a ficha de custo de referência");
      if (recipeSheetId === refSheetId) return badRequest("Não é permitido referenciar a própria ficha");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");

      const createsCycle = await wouldCreateRecipeSheetCycle(db, recipeSheetId, refSheetId);
      if (createsCycle) {
        return badRequest("Esta referência criaria ciclo entre fichas de custo");
      }

      const [sheet, refSnapshot] = await Promise.all([
        db.itemCostSheet.findFirst({ where: { id: recipeSheetId, itemId }, select: { id: true } }),
        getItemCostSheetSnapshot(db, refSheetId),
      ]);
      if (!sheet) return badRequest("Ficha de custo não encontrada para este item");

      const lineCount = await db.itemCostSheetLine.count({ where: { itemCostSheetId: recipeSheetId } });
      await db.itemCostSheetLine.create({
        data: {
          itemCostSheetId: recipeSheetId,
          type: "recipeSheet",
          refId: refSheetId,
          name: refSnapshot.sheet.name,
          unit: "ficha",
          quantity,
          unitCostAmount: Number(refSnapshot.unitCostAmount.toFixed(6)),
          totalCostAmount: Number((refSnapshot.unitCostAmount * quantity).toFixed(6)),
          sortOrderIndex: Number(lineCount || 0),
          notes: refSnapshot.note,
        },
      });
      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-move") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const direction = String(formData.get("direction") || "").trim();
      if (!recipeSheetId || !lineId) return badRequest("Linha inválida");
      if (!["up", "down"].includes(direction)) return badRequest("Direção inválida");

      const lines = await db.itemCostSheetLine.findMany({
        where: { itemCostSheetId: recipeSheetId },
        select: { id: true, sortOrderIndex: true, createdAt: true },
        orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
      });

      const currentIndex = lines.findIndex((line: any) => line.id === lineId);
      if (currentIndex < 0) return badRequest("Linha não encontrada");

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= lines.length) {
        return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
      }

      const current = lines[currentIndex];
      const target = lines[targetIndex];

      await db.$transaction([
        db.itemCostSheetLine.update({
          where: { id: current.id },
          data: { sortOrderIndex: Number(target.sortOrderIndex || 0) },
        }),
        db.itemCostSheetLine.update({
          where: { id: target.id },
          data: { sortOrderIndex: Number(current.sortOrderIndex || 0) },
        }),
      ]);

      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-update") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unitRaw = String(formData.get("unit") || "").trim();
      const quantity = Number(String(formData.get("quantity") || "0").replace(",", "."));
      const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
      const notes = String(formData.get("notes") || "").trim();
      if (!recipeSheetId || !lineId) return badRequest("Linha inválida");
      if (!(quantity > 0)) return badRequest("Informe uma quantidade válida");
      if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido");

      const line = await db.itemCostSheetLine.findFirst({
        where: { id: lineId, itemCostSheetId: recipeSheetId },
        select: { id: true, type: true, refId: true },
      });
      if (!line) return badRequest("Linha não encontrada");

      const isRefLine = (line.type === "recipe" || line.type === "recipeSheet") && !!line.refId;
      if (isRefLine) {
        await db.itemCostSheetLine.update({
          where: { id: lineId },
          data: {
            quantity,
            totalCostAmount: Number((unitCostAmount * quantity).toFixed(6)),
            notes: notes || null,
          },
        });
        await recalcItemCostSheetTotals(db, recipeSheetId);
        return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
      }

      await db.itemCostSheetLine.update({
        where: { id: lineId },
        data: {
          name: name || "Custo",
          unit: unitRaw || null,
          quantity,
          unitCostAmount,
          totalCostAmount: Number((unitCostAmount * quantity).toFixed(6)),
          notes: notes || null,
        },
      });
      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-delete") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      const lineId = String(formData.get("lineId") || "").trim();
      if (!recipeSheetId || !lineId) return badRequest("Linha inválida");

      const line = await db.itemCostSheetLine.findFirst({
        where: { id: lineId, itemCostSheetId: recipeSheetId },
        select: { id: true },
      });
      if (!line) return badRequest("Linha não encontrada");

      await db.itemCostSheetLine.delete({ where: { id: lineId } });
      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    if (_action === "item-cost-sheet-line-recalc") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "").trim();
      if (!recipeSheetId) return badRequest("Ficha de custo inválida");
      await recalcItemCostSheetTotals(db, recipeSheetId);
      return redirect(`/admin/items/${itemId}/item-cost-sheets?sheetId=${recipeSheetId}`);
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemCostSheetsTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const recipeSheets = item.ItemCostSheet || [];
  const payload = loaderData?.payload || {};
  const recipeSheetRows = (payload.recipeSheets || []) as any[];
  const selectedSheetId = String(payload.selectedSheetId || "");
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
  const selectedSheet = recipeSheetRows.find((sheet) => sheet.id === selectedSheetId) || null;
  const sheetLines = (selectedSheet?.ItemCostSheetLine || []) as any[];
  const totalFromLines = sheetLines.reduce((acc: number, line: any) => acc + Number(line.totalCostAmount || 0), 0);
  const selectedSheetDependencyCount = selectedSheet ? Number(recipeSheetDependencyCountById[selectedSheet.id] || 0) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fichas de custo vinculadas</h2>
          <p className="text-sm text-slate-600">{recipeSheets.length} ficha(s) de custo</p>
        </div>
        <Button asChild type="button" className="rounded-lg">
          <Link to={`/admin/item-cost-sheets/new?itemId=${item.id}`}>Criar ficha de custo</Link>
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {recipeSheets.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ficha de custo vinculada a este item.</p>
        ) : (
          recipeSheets.map((sheet: any) => (
            <div key={sheet.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{sheet.name}</div>
                  <div className="text-xs text-slate-500">
                    {sheet.isActive ? "Ativa" : "Inativa"}
                    {recipeSheetDependencyCountById[sheet.id] ? ` • usada por ${recipeSheetDependencyCountById[sheet.id]} ficha(s)` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`?sheetId=${sheet.id}`}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Abrir
                  </Link>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      sheet.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {sheet.isActive ? "Ativa" : "Rascunho/Arquivo"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {actionData?.status >= 400 ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}

      {selectedSheet ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Composição da ficha de custo</h3>
              <p className="text-sm text-slate-700">
                {selectedSheet.name} • Total: <span className="font-semibold">R$ {Number(totalFromLines || selectedSheet.costAmount || 0).toFixed(4)}</span>
              </p>
              <p className="text-xs text-slate-500">
                {selectedSheetDependencyCount > 0
                  ? `Esta ficha é usada por ${selectedSheetDependencyCount} outra(s) ficha(s) de custo.`
                  : "Esta ficha ainda não é referenciada por outras fichas de custo."}
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
              <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-recalc" className="rounded-lg">
                Recalcular ficha
              </Button>
            </Form>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Form method="post" className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
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
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="recipeQuantity">Quantidade</label>
                <input id="recipeQuantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-recipe">
                  Adicionar receita
                </Button>
              </div>
            </Form>

            <Form method="post" className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar outro custo</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualName">Nome</label>
                <input id="manualName" name="name" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Ex.: Mão de obra" required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnit">Unidade</label>
                  <input id="manualUnit" name="unit" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="h / un" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualQty">Qtd</label>
                  <input id="manualQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manualUnitCost">Custo un.</label>
                  <input id="manualUnitCost" name="unitCostAmount" type="number" min="0" step="0.0001" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
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

            <Form method="post" className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar mão de obra</h4>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborName">Nome</label>
                <input id="laborName" name="name" defaultValue="Mão de obra" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnit">Unidade</label>
                  <input id="laborUnit" name="unit" defaultValue="h" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborQty">Qtd</label>
                  <input id="laborQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="laborUnitCost">Custo un.</label>
                  <input id="laborUnitCost" name="unitCostAmount" type="number" min="0" step="0.0001" defaultValue="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
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

            <Form method="post" className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
              <h4 className="text-sm font-semibold text-slate-900">Adicionar ficha de custo</h4>
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
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="refSheetQty">Quantidade</label>
                <input id="refSheetQty" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" name="_action" value="item-cost-sheet-line-add-sheet">
                  Adicionar ficha
                </Button>
              </div>
            </Form>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Custo un.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Obs.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sheetLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nenhuma linha na ficha de custo.</td>
                  </tr>
                ) : (
                  sheetLines.map((line: any) => {
                    const refLocked = line.type === "recipe" || line.type === "recipeSheet";
                    const rowTone =
                      line.type === "recipe"
                        ? "bg-emerald-50/40"
                        : line.type === "recipeSheet"
                          ? "bg-blue-50/40"
                          : line.type === "labor"
                            ? "bg-amber-50/40"
                            : "";
                    return (
                    <tr key={line.id} className={`border-t border-slate-100 ${rowTone}`}>
                      <td className="px-3 py-2">{line.type}</td>
                      <td className="px-3 py-2">
                        <Form method="post" className="flex flex-col gap-1">
                          <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input
                            name="name"
                            defaultValue={line.name}
                            readOnly={refLocked}
                            className={`h-8 rounded border px-2 text-xs ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                          />
                          <div className="grid grid-cols-4 gap-1">
                            <input
                              name="unit"
                              defaultValue={line.unit || ""}
                              readOnly={refLocked}
                              className={`h-8 rounded border px-2 text-xs ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                            />
                            <input
                              name="quantity"
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              defaultValue={Number(line.quantity || 0)}
                              className="h-8 rounded border border-slate-200 px-2 text-xs text-right"
                              required
                            />
                            <input
                              name="unitCostAmount"
                              type="number"
                              min="0"
                              step="0.0001"
                              defaultValue={Number(line.unitCostAmount || 0)}
                              readOnly={refLocked}
                              className={`h-8 rounded border px-2 text-xs text-right ${refLocked ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}
                              required
                            />
                            <button
                              type="submit"
                              name="_action"
                              value="item-cost-sheet-line-update"
                              className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Salvar
                            </button>
                          </div>
                          <input
                            name="notes"
                            defaultValue={line.notes || ""}
                            className="h-8 rounded border border-slate-200 px-2 text-xs"
                            placeholder="Observação"
                          />
                        </Form>
                      </td>
                      <td className="px-3 py-2">{line.unit || "-"}</td>
                      <td className="px-3 py-2 text-right">{Number(line.quantity || 0).toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">R$ {Number(line.unitCostAmount || 0).toFixed(4)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">R$ {Number(line.totalCostAmount || 0).toFixed(4)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{line.notes || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Form method="post" className="inline">
                            <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
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
                            <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
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
                            <input type="hidden" name="recipeSheetId" value={selectedSheet.id} />
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
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
