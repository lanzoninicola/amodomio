import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DeleteItemButton } from "~/components/primitives/table-list";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

interface ItemCostSheetListItem {
  id: string;
  name: string;
  itemId: string;
  itemName: string;
  itemCategoryId: string | null;
  itemCategoryName: string | null;
  linkedVariationCount: number;
  createdVariationCount: number;
  isComplete: boolean;
  isActive: boolean;
  updatedAt: Date;
}

type ItemCategoryOption = {
  id: string;
  name: string;
};

async function supportsComponentModel(db: any) {
  try {
    return Boolean(db?.itemCostSheetComponent && typeof db.itemCostSheetComponent.count === "function");
  } catch {
    return false;
  }
}

async function getItemCostSheetDeletionGuard(
  db: any,
  params: { itemCostSheetId: string; isActive?: boolean | null }
) {
  const [referenceDependencyCount, baseDependencyCount] = await Promise.all([
    supportsComponentModel(db)
      ? db.itemCostSheetComponent.count({
        where: { type: "recipeSheet", refId: params.itemCostSheetId },
      })
      : db.itemCostSheetLine.count({
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

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "").trim();
    const db = prismaClient as any;

    if (_action === "item-cost-sheet-delete") {
      const itemCostSheetId = String(formData.get("itemCostSheetId") || "").trim();
      if (!itemCostSheetId) return badRequest("Ficha de custo inválida");

      const currentSheet = await db.itemCostSheet.findUnique({
        where: { id: itemCostSheetId },
        select: { id: true, baseItemCostSheetId: true },
      });
      if (!currentSheet) return badRequest("Ficha de custo não encontrada");

      const rootSheetId = currentSheet.baseItemCostSheetId || currentSheet.id;
      const groupSheets = await db.itemCostSheet.findMany({
        where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
        select: { id: true, isActive: true },
      });

      const deletionGuard = await getItemCostSheetDeletionGuard(db, {
        itemCostSheetId: rootSheetId,
        isActive: groupSheets.some((sheet: any) => Boolean(sheet.isActive)),
      });
      if (!deletionGuard.canDelete) {
        return badRequest(deletionGuard.reason || "Não foi possível eliminar a ficha");
      }

      await db.$transaction([
        db.itemCostSheet.deleteMany({ where: { baseItemCostSheetId: rootSheetId } }),
        db.itemCostSheet.delete({ where: { id: rootSheetId } }),
      ]);

      return ok({ message: "Ficha eliminada com sucesso" });
    }

    if (_action === "item-cost-sheet-bulk-activate") {
      const rawIds = formData
        .getAll("itemCostSheetIds")
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      const rootIds = Array.from(new Set(rawIds));
      if (rootIds.length === 0) return badRequest("Selecione ao menos uma ficha para ativar");

      const selectedSheets = await db.itemCostSheet.findMany({
        where: {
          OR: [
            { id: { in: rootIds } },
            { baseItemCostSheetId: { in: rootIds } },
          ],
        },
        select: {
          id: true,
          itemId: true,
          itemVariationId: true,
          baseItemCostSheetId: true,
        },
      });

      const groupMap = new Map<string, Array<{ id: string; itemId: string; itemVariationId: string }>>();
      for (const sheet of selectedSheets) {
        const rootId = String(sheet.baseItemCostSheetId || sheet.id || "");
        if (!rootId) continue;
        if (!groupMap.has(rootId)) groupMap.set(rootId, []);
        groupMap.get(rootId)?.push({
          id: String(sheet.id),
          itemId: String(sheet.itemId),
          itemVariationId: String(sheet.itemVariationId),
        });
      }

      if (groupMap.size !== rootIds.length) {
        return badRequest("Uma ou mais fichas selecionadas não foram encontradas");
      }

      const variationOwners = new Map<string, string>();
      for (const [rootId, sheets] of groupMap.entries()) {
        for (const sheet of sheets) {
          const ownershipKey = `${sheet.itemId}:${sheet.itemVariationId}`;
          const currentOwner = variationOwners.get(ownershipKey);
          if (currentOwner && currentOwner !== rootId) {
            return badRequest("Selecione apenas uma ficha por item/variação para ativação em lote");
          }
          variationOwners.set(ownershipKey, rootId);
        }
      }

      const selectedSheetIds = Array.from(groupMap.values()).flatMap((sheets) => sheets.map((sheet) => sheet.id));
      const now = new Date();

      const deactivateOps = Array.from(groupMap.values()).flatMap((sheets) =>
        sheets.map((sheet) =>
          db.itemCostSheet.updateMany({
            where: {
              itemId: sheet.itemId,
              itemVariationId: sheet.itemVariationId,
              isActive: true,
              id: { notIn: selectedSheetIds },
            },
            data: { isActive: false, status: "draft", activatedAt: null },
          })
        )
      );

      const activateOp = db.itemCostSheet.updateMany({
        where: { id: { in: selectedSheetIds } },
        data: { isActive: true, status: "active", activatedAt: now },
      });

      await db.$transaction([...deactivateOps, activateOp]);

      return ok({
        message: `${rootIds.length} ficha(s) ativada(s) com sucesso`,
      });
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [err, result] = await tryit(
    Promise.all([
      prismaClient.itemCostSheet.findMany({
        include: {
          Item: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              Category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              ItemVariation: {
                where: { deletedAt: null },
                select: { id: true },
              },
            },
          },
          ItemVariation: {
            select: {
              id: true,
              isReference: true,
              Variation: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prismaClient.category.findMany({
        where: { type: "item" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ])
  );

  if (err) {
    return serverError(err);
  }

  const [rows, categories] = result;

  const groupedByItem = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.baseItemCostSheetId || row.id || "");
    if (!key) continue;
    if (!groupedByItem.has(key)) groupedByItem.set(key, []);
    groupedByItem.get(key)?.push(row);
  }

  const recipeSheets: ItemCostSheetListItem[] = Array.from(groupedByItem.values()).map((itemSheets) => {
    const primarySheet =
      itemSheets.find((sheet: any) => !sheet.baseItemCostSheetId) ||
      itemSheets.find((sheet: any) => sheet.ItemVariation?.isReference && sheet.ItemVariation?.Variation?.code !== "base") ||
      itemSheets.find((sheet: any) => sheet.ItemVariation?.Variation?.code !== "base") ||
      itemSheets.find((sheet: any) => sheet.ItemVariation?.Variation?.code === "base") ||
      itemSheets[0];

    const linkedVariationCount = Number(primarySheet?.Item?.ItemVariation?.length || 0);
    const createdVariationCount = new Set(itemSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean)).size;
    const latestUpdatedAt = itemSheets.reduce((latest: Date, sheet: any) => {
      const current = new Date(sheet.updatedAt);
      return current > latest ? current : latest;
    }, new Date(primarySheet?.updatedAt || new Date()));

    return {
      id: primarySheet.id,
      name: primarySheet?.name || `Ficha tecnica ${primarySheet?.Item?.name || "Item"}`,
      itemId: primarySheet.itemId,
      itemName: primarySheet?.Item?.name || "Item desconhecido",
      itemCategoryId: primarySheet?.Item?.categoryId || null,
      itemCategoryName: primarySheet?.Item?.Category?.name || null,
      linkedVariationCount,
      createdVariationCount,
      isComplete: linkedVariationCount > 0 && createdVariationCount >= linkedVariationCount,
      isActive: itemSheets.some((sheet: any) => Boolean(sheet.isActive)),
      updatedAt: latestUpdatedAt,
    };
  });

  return ok({ recipeSheets, categories });
}

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("pt-BR");
}

export default function AdminItemCostSheetsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const recipeSheets = (loaderData?.payload?.recipeSheets || []) as ItemCostSheetListItem[];
  const categories = (loaderData?.payload?.categories || []) as ItemCategoryOption[];
  const [search, setSearch] = useState("");
  const [categoryFilterValue, setCategoryFilterValue] = useState("__all__");
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([]);

  useEffect(() => {
    if (!actionData?.status) return;
    toast({
      title: actionData.status >= 400 ? "Erro" : "Sucesso",
      description: actionData.message,
    });
    if (actionData.status < 400) {
      setSelectedSheetIds([]);
    }
  }, [actionData]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipeSheets.filter((sheet) => {
      const matchesCategory =
        categoryFilterValue === "__all__" || sheet.itemCategoryId === categoryFilterValue;
      if (!matchesCategory) return false;
      if (!query) return true;
      return (
        sheet.name.toLowerCase().includes(query) ||
        sheet.itemName.toLowerCase().includes(query)
      );
    });
  }, [categoryFilterValue, recipeSheets, search]);

  useEffect(() => {
    setSelectedSheetIds((current) => current.filter((id) => filtered.some((sheet) => sheet.id === id)));
  }, [filtered]);

  const filteredSheetIds = filtered.map((sheet) => sheet.id);
  const allFilteredSelected =
    filteredSheetIds.length > 0 &&
    filteredSheetIds.every((id) => selectedSheetIds.includes(id));
  const selectedCount = selectedSheetIds.length;

  function toggleSheetSelection(sheetId: string, checked: boolean) {
    setSelectedSheetIds((current) => {
      if (checked) return current.includes(sheetId) ? current : [...current, sheetId];
      return current.filter((id) => id !== sheetId);
    });
  }

  function toggleSelectAllFiltered(checked: boolean) {
    setSelectedSheetIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredSheetIds]));
      }
      return current.filter((id) => !filteredSheetIds.includes(id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {filtered.length} ficha(s) agrupadas por item.
          </p>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full max-w-[760px] flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full max-w-[620px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="search"
                  className="h-12 rounded-xl border-slate-300 bg-white pl-10 text-sm text-black placeholder:text-slate-400 focus-visible:border-black focus-visible:ring-1 focus-visible:ring-black"
                  placeholder="Pesquise por ficha de custo ou item vinculado"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Select value={categoryFilterValue} onValueChange={setCategoryFilterValue}>
                <SelectTrigger className="h-12 w-full rounded-xl border-slate-300 bg-white text-sm text-slate-700 md:w-[240px]">
                  <SelectValue placeholder="Todas as categorias">
                    {categoryFilterValue === "__all__"
                      ? "Todas as categorias"
                      : (categories.find((category) => category.id === categoryFilterValue)?.name ?? "Categoria")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm text-black">
              <span className="font-medium">ordenado por atualização</span>
              <span className="text-slate-600">{recipeSheets.length} no total</span>
              <span className="text-slate-600">{filtered.length} em exibição</span>
            </div>
          </div>
        </div>
      </div>

      <Form method="post" className={`flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all ${selectedCount > 0 ? "opacity-100" : "pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0"}`}>
        <input type="hidden" name="_action" value="item-cost-sheet-bulk-activate" />
        {selectedSheetIds.map((sheetId) => (
          <input key={sheetId} type="hidden" name="itemCostSheetIds" value={sheetId} />
        ))}
        <span className="text-sm font-medium text-slate-700">
          {selectedCount} ficha(s) selecionada(s)
        </span>
        <Button type="submit" size="sm" className="rounded-full">
          Ativar em lote
        </Button>
      </Form>

      {filtered.length === 0 ? (
        <NoRecordsFound text="Nenhuma ficha de custo encontrada" />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-slate-50/70">
                <TableHead className="h-10 w-[52px] px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Checkbox
                    checked={allFilteredSelected}
                    aria-label="Selecionar fichas visíveis"
                    onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                  />
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Item</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Variações</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ativa</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Atualizado</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sheet) => (
                <TableRow key={sheet.id} className="border-slate-100 hover:bg-slate-50/40">
                  <TableCell className="px-4 py-3">
                    <Checkbox
                      checked={selectedSheetIds.includes(sheet.id)}
                      aria-label={`Selecionar ficha ${sheet.name}`}
                      onCheckedChange={(checked) => toggleSheetSelection(sheet.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        to={`/admin/item-cost-sheets/${sheet.id}`}
                        className="truncate font-medium text-slate-900 hover:underline"
                      >
                        {sheet.name}
                      </Link>
                      <span className="text-xs text-slate-500">ID: {sheet.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-sm text-slate-800">{sheet.itemName}</div>
                    <div className="text-xs text-slate-500">
                      {sheet.itemCategoryName || "Sem categoria"} · 1 ficha principal com suas variações
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={sheet.isComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                      {sheet.createdVariationCount}/{sheet.linkedVariationCount} tamanhos
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={sheet.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}>
                      {sheet.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {formatDateTime(sheet.updatedAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/admin/item-cost-sheets/${sheet.id}`}>
                        <Button type="button" variant="outline" size="sm" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          Abrir ficha
                        </Button>
                      </Link>
                      <Form method="post">
                        <input type="hidden" name="itemCostSheetId" value={sheet.id} />
                        <DeleteItemButton
                          actionName="item-cost-sheet-delete"
                          variant="outline"
                          className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50"
                          label="Eliminar"
                          labelClassName="text-red-700"
                        />
                      </Form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{filtered.length} ficha(s) listada(s).</span>
            <span className="text-xs font-semibold text-slate-900">Visão agrupada por item</span>
          </div>
        </div>
      )}
    </div>
  );
}
