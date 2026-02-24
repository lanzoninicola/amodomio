import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "~/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { calculateItemCostMetrics, getItemAverageCostWindowDays } from "~/domain/item/item-cost-metrics.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

const PAGE_SIZE = 20;
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parsePage(raw: string | null) {
  const parsed = Number(raw || "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function buildPageHref(params: {
  q: string;
  categoryId: string;
  classification: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.classification) searchParams.set("classification", params.classification);
  searchParams.set("page", String(params.page));
  return `/admin/items?${searchParams.toString()}`;
}

function formatClassificationLabel(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function getClassificationBadgeClass(value?: string | null) {
  switch (value) {
    case "insumo":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "semi_acabado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "produto_final":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "embalagem":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "servico":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const categoryId = String(url.searchParams.get("categoryId") || "").trim();
    const classificationParam = String(url.searchParams.get("classification") || "").trim();
    const classification = ITEM_CLASSIFICATIONS.includes(classificationParam as (typeof ITEM_CLASSIFICATIONS)[number])
      ? classificationParam
      : "";
    const requestedPage = parsePage(url.searchParams.get("page"));
    const averageWindowDays = await getItemAverageCostWindowDays();

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (classification) {
      where.classification = classification;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [totalItems, menuItemsLinked, categories] = await Promise.all([
      db.item.count({ where }),
      db.menuItem.count({
        where: {
          itemId: {
            not: null,
          },
        },
      }),
      db.category.findMany({
        where: { type: "item" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    const items = await db.item.findMany({
      where,
      include: {
        ItemVariation: {
          where: {
            deletedAt: null,
            Variation: {
              is: { kind: "base", code: "base", deletedAt: null },
            },
          },
          take: 1,
          include: {
            ItemCostVariation: {
              select: {
                id: true,
                costAmount: true,
                unit: true,
                validFrom: true,
                createdAt: true,
                source: true,
              },
            },
            ItemCostVariationHistory: {
              select: {
                id: true,
                costAmount: true,
                unit: true,
                validFrom: true,
                createdAt: true,
                source: true,
              },
              orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
              take: 100,
            },
            Variation: {
              select: { id: true, kind: true, code: true, name: true },
            },
          },
        },
        MenuItem: {
          select: {
            Category: {
              select: { id: true, name: true },
            },
          },
          take: 5,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    for (const item of items) {
      if (!(item as any).ItemVariation?.length) {
        await itemVariationPrismaEntity.ensureBaseVariationForItem(item.id);
      }
    }

    return ok({
      items: items.map((item: any) => {
        const baseVariation = item.ItemVariation?.[0] || null;
        const baseHistory = baseVariation?.ItemCostVariationHistory || [];
        const currentCost = baseVariation?.ItemCostVariation;
        const historyForMetrics =
          baseHistory.length > 0
            ? baseHistory
            : currentCost
              ? [currentCost]
              : [];

        return {
          ...item,
          _baseItemVariation: baseVariation,
          _costMetrics: calculateItemCostMetrics({
            item,
            history: historyForMetrics,
            averageWindowDays,
          }),
        };
      }),
      stats: {
        totalItems,
        menuItemsLinked,
      },
      filters: {
        q,
        categoryId,
        classification,
      },
      categories,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages,
      },
      averageWindowDays,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");

    if (_action !== "items-bulk-update") {
      return badRequest("Ação inválida");
    }

    const itemIds = Array.from(
      new Set(
        formData
          .getAll("itemIds")
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );

    if (itemIds.length === 0) {
      return badRequest("Selecione ao menos um item");
    }

    const classificationRaw = String(formData.get("bulkClassification") || "").trim();
    const categoryRaw = String(formData.get("bulkCategoryId") || "").trim();

    const shouldUpdateClassification = classificationRaw && classificationRaw !== "__NO_CHANGE__";
    const shouldUpdateCategory = categoryRaw && categoryRaw !== "__NO_CHANGE__";

    if (!shouldUpdateClassification && !shouldUpdateCategory) {
      return badRequest("Selecione uma categoria e/ou classificação para atualizar");
    }

    const data: any = {};

    if (shouldUpdateClassification) {
      if (!ITEM_CLASSIFICATIONS.includes(classificationRaw as (typeof ITEM_CLASSIFICATIONS)[number])) {
        return badRequest("Classificação inválida");
      }
      data.classification = classificationRaw;
    }

    if (shouldUpdateCategory) {
      if (categoryRaw === "__EMPTY__") {
        data.categoryId = null;
      } else {
        const category = await db.category.findUnique({
          where: { id: categoryRaw },
          select: { id: true, type: true },
        });
        if (!category || category.type !== "item") {
          return badRequest("Categoria inválida");
        }
        data.categoryId = category.id;
      }
    }

    const result = await db.item.updateMany({
      where: { id: { in: itemIds } },
      data,
    });

    return ok({
      message: `${result.count} item(ns) atualizado(s) em lote`,
      updatedCount: result.count,
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const payload = loaderData?.payload as any;

  if (!payload) {
    return <div className="p-4 text-sm text-muted-foreground">Nao foi possivel carregar itens.</div>;
  }

  const items = payload.items || [];
  const stats = payload.stats || { totalItems: 0, menuItemsLinked: 0 };
  const filters = payload.filters || { q: "", categoryId: "", classification: "" };
  const categories = payload.categories || [];
  const categoryNameById = new Map<string, string>(categories.map((category: any) => [category.id, category.name]));
  const pagination = payload.pagination || { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };
  const averageWindowDays = payload.averageWindowDays || 30;
  const [categoryFilterValue, setCategoryFilterValue] = useState(filters.categoryId || "__all__");
  const [classificationFilterValue, setClassificationFilterValue] = useState(filters.classification || "__all__");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkCategoryValue, setBulkCategoryValue] = useState("__NO_CHANGE__");
  const [bulkClassificationValue, setBulkClassificationValue] = useState("__NO_CHANGE__");

  const pageItemIds = items.map((item: any) => item.id);
  const allPageSelected = pageItemIds.length > 0 && pageItemIds.every((id: string) => selectedItemIds.includes(id));
  const selectedCount = selectedItemIds.length;

  useEffect(() => {
    setCategoryFilterValue(filters.categoryId || "__all__");
    setClassificationFilterValue(filters.classification || "__all__");
  }, [filters.categoryId, filters.classification]);

  useEffect(() => {
    setSelectedItemIds([]);
  }, [pagination.page, filters.q, filters.categoryId, filters.classification]);

  function toggleItemSelection(itemId: string, checked: boolean) {
    setSelectedItemIds((current) => {
      if (checked) return current.includes(itemId) ? current : [...current, itemId];
      return current.filter((id) => id !== itemId);
    });
  }

  function toggleSelectAllPage(checked: boolean) {
    setSelectedItemIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...pageItemIds]));
      }
      return current.filter((id) => !pageItemIds.includes(id));
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Itens </h1>
          </div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ChevronLeft size={14} />
            Voltar
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
          <span>Custo médio: janela {averageWindowDays} dias</span>
          <span>•</span>
          <span>{pagination.totalItems} item(ns) encontrado(s)</span>
          <span>•</span>
          <span>{stats.menuItemsLinked} item(ns) vinculados ao cardapio</span>
          <span>•</span>
          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Form method="get" className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="q" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Busca
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Nome ou descricao"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="categoryId" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Categoria
            </label>
            <input type="hidden" name="categoryId" value={categoryFilterValue === "__all__" ? "" : categoryFilterValue} />
            <Select value={categoryFilterValue} onValueChange={setCategoryFilterValue}>
              <SelectTrigger id="categoryId" className="mt-1 w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="classification" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Classificacao
            </label>
            <input
              type="hidden"
              name="classification"
              value={classificationFilterValue === "__all__" ? "" : classificationFilterValue}
            />
            <Select value={classificationFilterValue} onValueChange={setClassificationFilterValue}>
              <SelectTrigger id="classification" className="mt-1 w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {ITEM_CLASSIFICATIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 md:col-span-4">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Filtrar
            </button>
            <Link
              to="/admin/items"
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Limpar
            </Link>
          </div>
        </Form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="items-bulk-update" />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-[220px]">
              <label htmlFor="bulkCategoryId" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Categoria (lote)
              </label>
              <input type="hidden" name="bulkCategoryId" value={bulkCategoryValue} />
              <Select value={bulkCategoryValue} onValueChange={setBulkCategoryValue}>
                <SelectTrigger id="bulkCategoryId" className="mt-1 w-full">
                  <SelectValue placeholder="Sem alteração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NO_CHANGE__">Sem alteração</SelectItem>
                  <SelectItem value="__EMPTY__">Remover categoria</SelectItem>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[220px]">
              <label htmlFor="bulkClassification" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Classificação (lote)
              </label>
              <input type="hidden" name="bulkClassification" value={bulkClassificationValue} />
              <Select value={bulkClassificationValue} onValueChange={setBulkClassificationValue}>
                <SelectTrigger id="bulkClassification" className="mt-1 w-full">
                  <SelectValue placeholder="Sem alteração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NO_CHANGE__">Sem alteração</SelectItem>
                  {ITEM_CLASSIFICATIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {selectedItemIds.map((id) => (
                <input key={id} type="hidden" name="itemIds" value={id} />
              ))}
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                disabled={selectedCount === 0}
              >
                Atualizar selecionados
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>{selectedCount} item(ns) selecionado(s) nesta página</span>
            {selectedCount > 0 ? (
              <button
                type="button"
                className="underline"
                onClick={() => setSelectedItemIds([])}
              >
                Limpar seleção
              </button>
            ) : null}
          </div>

          {actionData?.message ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                actionData?.status === 200
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {actionData.message}
            </div>
          ) : null}
        </Form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 w-12 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <input
                  type="checkbox"
                  aria-label="Selecionar itens da página"
                  checked={allPageSelected}
                  onChange={(e) => toggleSelectAllPage(e.currentTarget.checked)}
                />
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unidade
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Classificacao
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Categoria
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ultimo custo
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Custo medio
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum item encontrado (rode migration e backfill).
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: any) => {
                const latestCost = item._costMetrics?.latestCost || null;
                const costMetrics = item._costMetrics || null;
                const categoryName =
                  (item.categoryId ? categoryNameById.get(item.categoryId) : null) ||
                  "Não definido";
                const latestLabel = latestCost
                  ? `${BRL_FORMATTER.format(Number(latestCost.costAmount || 0))} ${latestCost.unit || ""}`.trim()
                  : "-";
                const avgLabel =
                  costMetrics?.averageCostPerConsumptionUnit != null
                    ? `${BRL_FORMATTER.format(Number(costMetrics.averageCostPerConsumptionUnit))} ${item.consumptionUm || ""}`.trim()
                    : "-";

                return (
                  <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${item.name}`}
                        checked={selectedItemIds.includes(item.id)}
                        onChange={(e) => toggleItemSelection(item.id, e.currentTarget.checked)}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          to={`/admin/items/${item.id}`}
                          className="truncate font-semibold text-slate-900 hover:underline"
                          title={item.name}
                        >
                          {item.name}
                        </Link>
                        <span className="text-xs text-slate-500">ID: {item.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className="border-slate-200 bg-white font-medium text-slate-700">
                        {item.consumptionUm || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={getClassificationBadgeClass(item.classification)}>
                        {formatClassificationLabel(item.classification)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {categoryName !== "Não definido" ? (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 font-medium text-slate-700">
                          {categoryName}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">Não definido</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">{latestLabel}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">{avgLabel}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-slate-500">{selectedCount} of {pagination.totalItems} row(s) selected.</div>

          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Rows per page</span>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                aria-label={`Rows per page: ${pagination.pageSize}`}
              >
                <span>{pagination.pageSize}</span>
                <ChevronLeft className="h-4 w-4 rotate-[-90deg] text-slate-400" />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-900">
              Page {pagination.page} of {pagination.totalPages}
            </div>

            <Pagination className="mx-0 w-auto justify-start">
              <PaginationContent className="gap-1.5">
                <PaginationItem>
                  <PaginationLink
                    href={
                      pagination.page > 1
                        ? buildPageHref({
                            q: filters.q,
                            categoryId: filters.categoryId,
                            classification: filters.classification,
                            page: 1,
                          })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Primeira pagina"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={
                      pagination.page > 1
                        ? buildPageHref({
                            q: filters.q,
                            categoryId: filters.categoryId,
                            classification: filters.classification,
                            page: pagination.page - 1,
                          })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Pagina anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={
                      pagination.page < pagination.totalPages
                        ? buildPageHref({
                            q: filters.q,
                            categoryId: filters.categoryId,
                            classification: filters.classification,
                            page: pagination.page + 1,
                          })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Proxima pagina"
                  >
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={
                      pagination.page < pagination.totalPages
                        ? buildPageHref({
                            q: filters.q,
                            categoryId: filters.categoryId,
                            classification: filters.classification,
                            page: pagination.totalPages,
                          })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Ultima pagina"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}
