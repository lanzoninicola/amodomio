import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronsLeft, ChevronsRight, ListFilter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { DeleteItemButton } from "~/components/primitives/table-list";
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
const ITEM_CLASSIFICATION_TABS = ["insumo", "semi_acabado", "produto_final", "outros"] as const;
const PRIMARY_ITEM_CLASSIFICATIONS = ["insumo", "semi_acabado", "produto_final"] as const;
const ITEM_STATUS_FILTERS = ["active", "inactive", "all"] as const;

const PAGE_SIZE = 20;
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const DUPLICATE_WORDS_TO_IGNORE = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "italiano",
  "italiana",
  "caseiro",
  "caseira",
  "tradicional",
  "especial",
  "premium",
  "gourmet",
  "artesanal",
]);

function normalizeItemName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !DUPLICATE_WORDS_TO_IGNORE.has(word))
    .join(" ");
}

function parsePage(raw: string | null) {
  const parsed = Number(raw || "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function buildBaseItemWhere(params: {
  q: string;
  categoryId: string;
  status: string;
}) {
  const where: any = { AND: [] as any[] };

  if (params.status === "active") where.active = true;
  if (params.status === "inactive") where.active = false;

  if (params.q) {
    where.AND.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (where.AND.length === 0) {
    delete where.AND;
  }

  return where;
}

function buildClassificationWhere(baseWhere: any, classification: string) {
  const where: any = {
    ...baseWhere,
    AND: Array.isArray(baseWhere?.AND) ? [...baseWhere.AND] : [],
  };

  if (PRIMARY_ITEM_CLASSIFICATIONS.includes(classification as (typeof PRIMARY_ITEM_CLASSIFICATIONS)[number])) {
    where.classification = classification;
  } else if (classification === "outros") {
    where.AND.push({
      OR: [
        { classification: null },
        { classification: "" },
        { classification: { notIn: [...PRIMARY_ITEM_CLASSIFICATIONS] } },
      ],
    });
  }

  if (where.AND.length === 0) {
    delete where.AND;
  }

  return where;
}

function getClassificationTabValue(classification?: string | null) {
  if (!classification || classification === "" || !PRIMARY_ITEM_CLASSIFICATIONS.includes(classification as (typeof PRIMARY_ITEM_CLASSIFICATIONS)[number])) {
    return "outros" as const;
  }

  return classification as (typeof ITEM_CLASSIFICATION_TABS)[number];
}

function buildPageHref(params: {
  q: string;
  categoryId: string;
  classification: string;
  status: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.classification) searchParams.set("classification", params.classification);
  if (params.status) searchParams.set("status", params.status);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  return `/admin/items?${searchParams.toString()}`;
}

function formatClassificationTabLabel(value: (typeof ITEM_CLASSIFICATION_TABS)[number]) {
  if (value === "outros") return "outros";
  return value.replaceAll("_", " ");
}

function getClassificationTabColor(value: string) {
  switch (value) {
    case "insumo":
      return { dot: "bg-sky-400", activeBorder: "border-sky-600", activeText: "text-sky-900" };
    case "semi_acabado":
      return { dot: "bg-amber-400", activeBorder: "border-amber-500", activeText: "text-amber-900" };
    case "produto_final":
      return { dot: "bg-emerald-500", activeBorder: "border-emerald-600", activeText: "text-emerald-900" };
    default:
      return { dot: "bg-slate-400", activeBorder: "border-slate-500", activeText: "text-slate-900" };
  }
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

function pickPrimaryItemVariation(item: any) {
  const activeVariations = (item?.ItemVariation || []).filter((row: any) => !row?.deletedAt);

  return activeVariations.find((row: any) => row.isReference) || activeVariations[0] || null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const categoryId = String(url.searchParams.get("categoryId") || "").trim();
    const classificationParam = String(url.searchParams.get("classification") || "").trim();
    const classification = ITEM_CLASSIFICATION_TABS.includes(classificationParam as (typeof ITEM_CLASSIFICATION_TABS)[number])
      ? classificationParam
      : "insumo";
    const statusParam = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const status = ITEM_STATUS_FILTERS.includes(statusParam as (typeof ITEM_STATUS_FILTERS)[number])
      ? statusParam
      : "active";
    const requestedPage = parsePage(url.searchParams.get("page"));
    const averageWindowDays = await getItemAverageCostWindowDays();

    const baseWhere = buildBaseItemWhere({ q, categoryId, status });
    const where = buildClassificationWhere(baseWhere, classification);

    const [totalItems, menuItemsLinked, categories, classificationRows] = await Promise.all([
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
      db.item.findMany({
        where: baseWhere,
        select: { classification: true },
      }),
    ]);

    const classificationCounts = ITEM_CLASSIFICATION_TABS.reduce(
      (acc, tabValue) => {
        acc[tabValue] = 0;
        return acc;
      },
      {} as Record<(typeof ITEM_CLASSIFICATION_TABS)[number], number>,
    );

    for (const row of classificationRows) {
      const tabValue = getClassificationTabValue(row.classification);
      classificationCounts[tabValue] += 1;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    const items = await db.item.findMany({
      where,
      include: {
        ItemVariation: {
          where: { deletedAt: null },
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
                metadata: true,
              },
              orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
              take: 100,
            },
            Variation: {
              select: { id: true, kind: true, code: true, name: true },
            },
          },
          orderBy: [{ createdAt: "asc" }],
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

    const refreshedItems = await db.item.findMany({
      where: { id: { in: items.map((item: any) => item.id) } },
      include: {
        ItemVariation: {
          where: { deletedAt: null },
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
                metadata: true,
              },
              orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
              take: 100,
            },
            Variation: {
              select: { id: true, kind: true, code: true, name: true },
            },
          },
          orderBy: [{ createdAt: "asc" }],
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
    });

    return ok({
      items: refreshedItems.map((item: any) => {
        const baseVariation = pickPrimaryItemVariation(item);
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
        status,
      },
      classificationCounts,
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
      if (_action === "item-delete") {
        const itemId = String(formData.get("id") || "").trim();
        if (!itemId) {
          return badRequest("Item inválido");
        }

        const item = await db.item.findUnique({
          where: { id: itemId },
          select: { id: true, name: true },
        });
        if (!item) {
          return badRequest("Item não encontrado");
        }

        const stockMovementLookup =
          typeof db.stockMovement?.findFirst === "function"
            ? db.stockMovement.findFirst({
              where: { itemId, deletedAt: null },
              select: { id: true },
            })
            : typeof db.stockMovementImportBatchLine?.findFirst === "function"
              ? db.stockMovementImportBatchLine.findFirst({
                where: { mappedItemId: itemId, appliedAt: { not: null }, rolledBackAt: null },
                select: { id: true },
              })
              : Promise.resolve(null);
        const recipeUsageLookup =
          typeof db.recipeIngredient?.findFirst === "function"
            ? db.recipeIngredient.findFirst({
              where: { ingredientItemId: itemId },
              select: { id: true },
            })
            : typeof db.recipeLine?.findFirst === "function"
              ? db.recipeLine.findFirst({
                where: { itemId },
                select: { id: true },
              })
              : Promise.resolve(null);

        const [
          stockMovement,
          recipeLine,
          recipe,
          menuItem,
          itemCostSheet,
        ] = await Promise.all([
          stockMovementLookup,
          recipeUsageLookup,
          db.recipe.findFirst({ where: { itemId }, select: { id: true } }),
          db.menuItem.findFirst({ where: { itemId }, select: { id: true } }),
          db.itemCostSheet.findFirst({ where: { itemId }, select: { id: true } }),
        ]);

        const reasons: string[] = [];
        if (stockMovement) reasons.push("existem movimentações de estoque");
        if (recipeLine) reasons.push("está sendo usado como ingrediente em receitas");
        if (recipe) reasons.push("está vinculado a uma receita");
        if (menuItem) reasons.push("está vinculado ao cardápio");
        if (itemCostSheet) reasons.push("possui fichas de custo");

        if (reasons.length > 0) {
          return badRequest(`Não é possível eliminar o item porque ${reasons.join(", ")}.`);
        }

        await db.item.delete({ where: { id: itemId } });

        return ok({ message: "Item eliminado com sucesso" });
      }

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
    const activeRaw = String(formData.get("bulkActive") || "").trim();

    const shouldUpdateClassification = classificationRaw && classificationRaw !== "__NO_CHANGE__";
    const shouldUpdateCategory = categoryRaw && categoryRaw !== "__NO_CHANGE__";
    const shouldUpdateActive = activeRaw && activeRaw !== "__NO_CHANGE__";

    if (!shouldUpdateClassification && !shouldUpdateCategory && !shouldUpdateActive) {
      return badRequest("Selecione uma categoria, classificação e/ou status para atualizar");
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

    if (shouldUpdateActive) {
      if (activeRaw !== "active" && activeRaw !== "inactive") {
        return badRequest("Status inválido");
      }
      data.active = activeRaw === "active";
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
  const filters = payload.filters || { q: "", categoryId: "", classification: "insumo", status: "active" };
  const classificationCounts = payload.classificationCounts || {
    insumo: 0,
    semi_acabado: 0,
    produto_final: 0,
    outros: 0,
  };
  const categories = payload.categories || [];
  const categoryNameById = new Map<string, string>(categories.map((category: any) => [category.id, category.name]));
  const pagination = payload.pagination || { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };
  const averageWindowDays = payload.averageWindowDays || 30;
  const classificationTabValue = ITEM_CLASSIFICATION_TABS.includes(
    filters.classification as (typeof ITEM_CLASSIFICATION_TABS)[number],
  )
    ? filters.classification
    : "insumo";
  const [categoryFilterValue, setCategoryFilterValue] = useState(filters.categoryId || "__all__");
  const [statusFilterValue, setStatusFilterValue] = useState(filters.status || "active");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkCategoryValue, setBulkCategoryValue] = useState("__NO_CHANGE__");
  const [bulkClassificationValue, setBulkClassificationValue] = useState("__NO_CHANGE__");
  const [bulkActiveValue, setBulkActiveValue] = useState("__NO_CHANGE__");

  const duplicateCounts = items.reduce((acc: Map<string, number>, item: any) => {
    const key = normalizeItemName(item?.name || "");
    if (!key) return acc;
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map<string, number>());

  const pageItemIds = items.map((item: any) => item.id);
  const allPageSelected = pageItemIds.length > 0 && pageItemIds.every((id: string) => selectedItemIds.includes(id));
  const selectedCount = selectedItemIds.length;

  useEffect(() => {
    setCategoryFilterValue(filters.categoryId || "__all__");
    setStatusFilterValue(filters.status || "active");
  }, [filters.categoryId, filters.status]);

  useEffect(() => {
    setSelectedItemIds([]);
  }, [pagination.page, filters.q, filters.categoryId, filters.classification, filters.status]);

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{pagination.totalItems} item(ns)</span>
        <span>·</span>
        <span>{stats.menuItemsLinked} no cardápio</span>
        <span>·</span>
        <span>Custo médio: {averageWindowDays} dias</span>
        <span>·</span>
        <span>Pág. {pagination.page}/{pagination.totalPages}</span>
      </div>

      {/* Search + filter controls row */}
      <Form method="get" className="flex flex-wrap items-center gap-6">
        <input type="hidden" name="classification" value={classificationTabValue} />
        <input type="hidden" name="categoryId" value={categoryFilterValue === "__all__" ? "" : categoryFilterValue} />
        <input type="hidden" name="status" value={statusFilterValue} />

        <div className="relative flex min-w-[260px] flex-1 items-center ">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Pesquise por nome ou descrição"
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button type="submit" className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600" title="Filtrar">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>nome</span>
        </button>

        <Select value={statusFilterValue} onValueChange={setStatusFilterValue}>
          <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-blue-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-blue-400">
            <SelectValue>
              {statusFilterValue === "active" ? "produtos ativos" : statusFilterValue === "inactive" ? "produtos inativos" : "todos os produtos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">produtos ativos</SelectItem>
            <SelectItem value="inactive">produtos inativos</SelectItem>
            <SelectItem value="all">todos os produtos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilterValue} onValueChange={setCategoryFilterValue}>
          <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-slate-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-slate-400">
            <SelectValue>
              {categoryFilterValue === "__all__" ? "todas as categorias" : (categoryNameById.get(categoryFilterValue) ?? "categoria")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">todas as categorias</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ListFilter className="h-3.5 w-3.5" />
          <span>filtros</span>
        </button>

        <Link to="/admin/items" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
          <XCircle className="h-3.5 w-3.5" />
          <span>limpar filtros</span>
        </Link>
      </Form>

      {/* Bulk update form - compact bar, only visible when items are selected */}
      <Form method="post" className={`flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 transition-all ${selectedCount > 0 ? "opacity-100" : "pointer-events-none opacity-0 h-0 py-0 overflow-hidden border-0"}`}>
        <input type="hidden" name="_action" value="items-bulk-update" />
        <span className="text-xs font-medium text-slate-500">Lote ({selectedCount} selecionado(s)):</span>

        <input type="hidden" name="bulkCategoryId" value={bulkCategoryValue} />
        <Select value={bulkCategoryValue} onValueChange={setBulkCategoryValue}>
          <SelectTrigger className="h-7 w-auto min-w-[130px] border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NO_CHANGE__">Categoria</SelectItem>
            <SelectItem value="__EMPTY__">Remover categoria</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input type="hidden" name="bulkClassification" value={bulkClassificationValue} />
        <Select value={bulkClassificationValue} onValueChange={setBulkClassificationValue}>
          <SelectTrigger className="h-7 w-auto min-w-[130px] border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NO_CHANGE__">Classificação</SelectItem>
            {ITEM_CLASSIFICATIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input type="hidden" name="bulkActive" value={bulkActiveValue} />
        <Select value={bulkActiveValue} onValueChange={setBulkActiveValue}>
          <SelectTrigger className="h-7 w-auto min-w-[90px] border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NO_CHANGE__">Status</SelectItem>
            <SelectItem value="active">Ativar</SelectItem>
            <SelectItem value="inactive">Desativar</SelectItem>
          </SelectContent>
        </Select>

        {selectedItemIds.map((id) => (
          <input key={id} type="hidden" name="itemIds" value={id} />
        ))}
        <button
          type="submit"
          className="inline-flex h-7 items-center rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          disabled={selectedCount === 0}
        >
          Atualizar
        </button>
        {selectedCount > 0 && (
          <button type="button" className="text-xs text-slate-400 underline hover:text-slate-600" onClick={() => setSelectedItemIds([])}>
            Limpar seleção
          </button>
        )}
      </Form>

      {actionData?.message ? (
        <div
          className={`rounded-md px-3 py-2 text-sm ${actionData?.status === 200
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
        >
          {actionData.message}
        </div>
      ) : null}

      <div className="overflow-hidden  bg-white">
        <div className="flex items-end justify-between border-b border-slate-200 px-4">
          <div className="flex">
            {ITEM_CLASSIFICATION_TABS.map((tabValue) => {
              const isActive = classificationTabValue === tabValue;
              const color = getClassificationTabColor(tabValue);
              return (
                <Link
                  key={tabValue}
                  to={buildPageHref({ q: filters.q, categoryId: filters.categoryId, classification: tabValue, status: filters.status })}
                  className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${isActive
                    ? `border-b-2 ${color.activeBorder} ${color.activeText}`
                    : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${color.dot} ${isActive ? "" : "opacity-50"}`} />
                    <span className={isActive ? "font-semibold" : "font-medium"}>
                      {formatClassificationTabLabel(tabValue)} ({classificationCounts[tabValue] || 0})
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <button type="button" className="mb-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Colunas">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 w-12 px-4 text-slate-500">
                <input
                  type="checkbox"
                  aria-label="Selecionar itens da página"
                  checked={allPageSelected}
                  onChange={(e) => toggleSelectAllPage(e.currentTarget.checked)}
                />
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Nome <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Unidade <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Classificação <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Categoria <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                <span className="inline-flex items-center justify-end gap-1">Último custo <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                <span className="inline-flex items-center justify-end gap-1">Custo médio <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum item encontrado (rode migration e backfill).
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: any) => {
                const normalizedName = normalizeItemName(item.name || "");
                const duplicateCount = normalizedName ? duplicateCounts.get(normalizedName) || 0 : 0;
                const isDuplicate = duplicateCount > 1;
                const latestCost = item._costMetrics?.latestCost || null;
                const costMetrics = item._costMetrics || null;
                const categoryName =
                  (item.categoryId ? categoryNameById.get(item.categoryId) : null) ||
                  "Não definido";
                const latestLabel = latestCost
                  ? `${BRL_FORMATTER.format(Number(costMetrics?.latestCostPerConsumptionUnit || 0))} ${item.consumptionUm || latestCost.unit || ""}`.trim()
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/items/${item.id}`}
                            className="truncate font-semibold text-slate-900 hover:underline"
                            title={item.name}
                          >
                            {item.name}
                          </Link>
                          {isDuplicate ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                              title={`Possível duplicado (${duplicateCount} itens com nome normalizado igual)`}
                            >
                              Duplicado
                            </Badge>
                          ) : null}
                        </div>
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
                    <TableCell className="px-4 py-3">
                      {item.active ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">{latestLabel}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">{avgLabel}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Form method="post">
                          <input type="hidden" name="id" value={item.id} />
                          <DeleteItemButton actionName="item-delete" />
                        </Form>
                      </div>
                    </TableCell>
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
                          status: filters.status,
                          page: 1,
                        })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
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
                          status: filters.status,
                          page: pagination.page - 1,
                        })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
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
                          status: filters.status,
                          page: pagination.page + 1,
                        })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""
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
                          status: filters.status,
                          page: pagination.totalPages,
                        })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""
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
