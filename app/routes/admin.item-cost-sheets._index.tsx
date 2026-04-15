import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Eye, ListFilter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { DeleteItemButton } from "~/components/primitives/table-list";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

type ItemCostSheetChannelSummary = {
  key: string;
  name: string;
};

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
  activeChannels: ItemCostSheetChannelSummary[];
  referenceVariationName: string | null;
  referenceVariationCostAmount: number;
}

type ItemCategoryOption = {
  id: string;
  name: string;
};

type SellingChannelOption = {
  key: string;
  name: string;
  sortOrderIndex: number;
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
              active: true,
              canSell: true,
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
              ItemSellingInfo: {
                select: {
                  upcoming: true,
                },
              },
              ItemSellingChannelItem: {
                select: {
                  visible: true,
                  ItemSellingChannel: {
                    select: {
                      id: true,
                      key: true,
                      name: true,
                    },
                  },
                },
              },
              ItemSellingPriceVariation: {
                where: { published: true },
                select: {
                  itemSellingChannelId: true,
                  ItemSellingChannel: {
                    select: {
                      id: true,
                      key: true,
                      name: true,
                    },
                  },
                },
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
      prismaClient.itemSellingChannel.findMany({
        select: {
          key: true,
          name: true,
          sortOrderIndex: true,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
    ])
  );

  if (err) {
    return serverError(err);
  }

  const [rows, categories, sellingChannels] = result;

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
    const referenceSheet =
      itemSheets.find((sheet: any) => sheet.ItemVariation?.isReference) ||
      itemSheets.find((sheet: any) => !sheet.baseItemCostSheetId) ||
      itemSheets[0];

    const linkedVariationCount = Number(primarySheet?.Item?.ItemVariation?.length || 0);
    const createdVariationCount = new Set(itemSheets.map((sheet: any) => String(sheet.itemVariationId || "")).filter(Boolean)).size;
    const latestUpdatedAt = itemSheets.reduce((latest: Date, sheet: any) => {
      const current = new Date(sheet.updatedAt);
      return current > latest ? current : latest;
    }, new Date(primarySheet?.updatedAt || new Date()));
    const enabledVisibleChannelMap = new Map<string, ItemCostSheetChannelSummary>();

    if (
      primarySheet?.Item?.canSell &&
      primarySheet?.Item?.active &&
      primarySheet?.Item?.ItemSellingInfo?.upcoming !== true
    ) {
      const visibleChannelKeys = new Set(
        (primarySheet?.Item?.ItemSellingChannelItem || [])
          .filter((row: any) => row?.visible === true)
          .map((row: any) => String(row?.ItemSellingChannel?.key || "").toLowerCase())
          .filter(Boolean)
      );

      for (const row of primarySheet?.Item?.ItemSellingPriceVariation || []) {
        const channelKey = String(row?.ItemSellingChannel?.key || "").toLowerCase();
        if (!channelKey || !visibleChannelKeys.has(channelKey)) continue;
        if (enabledVisibleChannelMap.has(channelKey)) continue;

        enabledVisibleChannelMap.set(channelKey, {
          key: channelKey,
          name: row?.ItemSellingChannel?.name || channelKey.toUpperCase(),
        });
      }
    }

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
      activeChannels: Array.from(enabledVisibleChannelMap.values()),
      referenceVariationName: referenceSheet?.ItemVariation?.Variation?.name || null,
      referenceVariationCostAmount: Number(referenceSheet?.costAmount || 0),
    };
  });

  const channelTabs: SellingChannelOption[] = (sellingChannels || []).map((channel: any) => ({
    key: String(channel.key || "").toLowerCase(),
    name: channel.name || String(channel.key || "").toUpperCase(),
    sortOrderIndex: Number(channel.sortOrderIndex || 0),
  }));

  return ok({ recipeSheets, categories, channelTabs });
}

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export default function AdminItemCostSheetsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const recipeSheets = (loaderData?.payload?.recipeSheets || []) as ItemCostSheetListItem[];
  const categories = (loaderData?.payload?.categories || []) as ItemCategoryOption[];
  const channelTabs = (loaderData?.payload?.channelTabs || []) as SellingChannelOption[];
  const [search, setSearch] = useState("");
  const [categoryFilterValue, setCategoryFilterValue] = useState("__all__");
  const [activeChannelTab, setActiveChannelTab] = useState("__initial__");
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

  const baseFiltered = useMemo(() => {
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

  const visibleChannelTabs = useMemo(
    () =>
      channelTabs.filter((channel) =>
        baseFiltered.some((sheet) => sheet.activeChannels.some((sheetChannel) => sheetChannel.key === channel.key))
      ),
    [baseFiltered, channelTabs]
  );

  const resolvedActiveChannelTab =
    activeChannelTab === "__initial__" ? visibleChannelTabs[0]?.key || "__others__" : activeChannelTab;

  useEffect(() => {
    if (activeChannelTab === "__others__" || visibleChannelTabs.some((tab) => tab.key === activeChannelTab)) return;
    setActiveChannelTab(visibleChannelTabs[0]?.key || "__others__");
  }, [activeChannelTab, visibleChannelTabs]);

  const filtered = useMemo(() => {
    if (resolvedActiveChannelTab === "__others__") {
      return baseFiltered.filter((sheet) => sheet.activeChannels.length === 0);
    }

    return baseFiltered.filter((sheet) =>
      sheet.activeChannels.some((channel) => channel.key === resolvedActiveChannelTab)
    );
  }, [baseFiltered, resolvedActiveChannelTab]);

  const otherSheetsCount = useMemo(
    () => baseFiltered.filter((sheet) => sheet.activeChannels.length === 0).length,
    [baseFiltered]
  );

  useEffect(() => {
    setSelectedSheetIds((current) => current.filter((id) => filtered.some((sheet) => sheet.id === id)));
  }, [filtered]);

  const filteredSheetIds = filtered.map((sheet) => sheet.id);
  const allFilteredSelected =
    filteredSheetIds.length > 0 &&
    filteredSheetIds.every((id) => selectedSheetIds.includes(id));
  const selectedCount = selectedSheetIds.length;
  const activeTabMeta = channelTabs.find((channel) => channel.key === resolvedActiveChannelTab) || null;

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{recipeSheets.length} ficha(s)</span>
        <span>·</span>
        <span>{filtered.length} em exibição</span>
        <span>·</span>
        <span>{baseFiltered.length} após filtros</span>
        <span>·</span>
        <span>
          Canal: {resolvedActiveChannelTab === "__others__" ? "Outras" : activeTabMeta?.name || "Sem canal"}
        </span>
      </div>

      <section className="space-y-4">
        <Form method="get" onSubmit={(event) => event.preventDefault()} className="flex flex-wrap items-center gap-6">
          <div className="relative flex min-w-[260px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Pesquise por ficha de custo ou item vinculado"
              className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm focus:border-slate-400 focus:outline-none"
            />
            <button type="submit" className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600" title="Filtrar">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>atualização</span>
          </button>

          <Select value={categoryFilterValue} onValueChange={setCategoryFilterValue}>
            <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-slate-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-slate-400">
              <SelectValue placeholder="Todas as categorias">
                {categoryFilterValue === "__all__"
                  ? "todas as categorias"
                  : (categories.find((category) => category.id === categoryFilterValue)?.name ?? "categoria")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">todas as categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ListFilter className="h-3.5 w-3.5" />
            <span>filtros</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
            onClick={() => {
              setSearch("");
              setCategoryFilterValue("__all__");
              setActiveChannelTab("__initial__");
            }}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>limpar filtros</span>
          </button>
        </Form>

        <div className="overflow-hidden bg-white">
          <div className="flex items-end justify-between border-b border-slate-200 px-1">
            <div className="flex">
            {visibleChannelTabs.map((channel) => {
              const isActive = resolvedActiveChannelTab === channel.key;
              const count = baseFiltered.filter((sheet) =>
                sheet.activeChannels.some((sheetChannel) => sheetChannel.key === channel.key)
              ).length;

              return (
                <button
                  key={channel.key}
                  type="button"
                  onClick={() => setActiveChannelTab(channel.key)}
                  className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "border-b-2 border-sky-600 text-sky-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 ${isActive ? "font-semibold" : "font-medium"}`}>
                    <span className={`h-2 w-2 rounded-full bg-sky-400 ${isActive ? "" : "opacity-50"}`} />
                    {channel.name} ({count})
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveChannelTab("__others__")}
              className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${
                resolvedActiveChannelTab === "__others__"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 ${resolvedActiveChannelTab === "__others__" ? "font-semibold" : "font-medium"}`}>
                <span className={`h-2 w-2 rounded-full bg-slate-400 ${resolvedActiveChannelTab === "__others__" ? "" : "opacity-50"}`} />
                Outras ({otherSheetsCount})
              </span>
            </button>
          </div>
            <button type="button" className="mb-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Colunas">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

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
        <div className="overflow-hidden bg-white">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead className="h-10 w-[52px] px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Checkbox
                    checked={allFilteredSelected}
                    aria-label="Selecionar fichas visíveis"
                    onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                  />
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Item</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Canal comercial</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Custo ref.</TableHead>
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
                        className="truncate font-semibold text-slate-900 hover:underline"
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
                    {sheet.activeChannels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {sheet.activeChannels.map((channel) => (
                          <Badge
                            key={`${sheet.id}-${channel.key}`}
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-sky-700"
                          >
                            {channel.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Sem canal ativo publicado</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{formatMoney(sheet.referenceVariationCostAmount)}</div>
                      <div className="text-xs text-slate-500">
                        {sheet.referenceVariationName ? `Base: ${sheet.referenceVariationName}` : "Sem variação de referência"}
                      </div>
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
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/admin/item-cost-sheets/${sheet.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                        title="Abrir ficha"
                      >
                        <Eye size={15} />
                      </Link>
                      <Form method="post">
                        <input type="hidden" name="itemCostSheetId" value={sheet.id} />
                        <DeleteItemButton
                          actionName="item-cost-sheet-delete"
                          variant="outline"
                          className="h-8 w-8 rounded-md border-red-200 bg-white px-0 text-red-700 hover:bg-red-50"
                        />
                      </Form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>{filtered.length} ficha(s) listada(s).</span>
            <span className="text-xs font-semibold text-slate-900">Visão comercial agrupada por item</span>
          </div>
        </div>
      )}
    </div>
  );
}
