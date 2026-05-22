import { redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ArrowUpDown, ChevronLeft, ChevronsLeft, ChevronsRight, Download, ListFilter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "~/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

const PAGE_SIZE = 20;
const ITEM_STATUS_FILTERS = ["active", "inactive", "all"] as const;
const EXPORT_VISIBILITY_FILTERS = ["all", "visible", "hidden"] as const;
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const meta: MetaFunction = () => [
  { title: "Vendas | Itens vendidos" },
];

type SellingChannelTab = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  count: number;
};

type TagFilterOption = {
  id: string;
  name: string;
};

type ExportVisibilityFilter = (typeof EXPORT_VISIBILITY_FILTERS)[number];

type SellingRow = {
  id: string;
  name: string;
  classification: string;
  active: boolean;
  canSell: boolean;
  updatedAt: string | null;
  categoryName: string | null;
  sellingCategoryName: string | null;
  groupName: string | null;
  slug: string | null;
  upcoming: boolean;
  channelVisible: boolean;
  totalVariations: number;
  totalPriceEntries: number;
  channelPriceEntries: number;
  referenceVariationName: string | null;
  referencePriceAmount: number | null;
  updatedBy: string | null;
  commerciallyReady: boolean;
};

function parseExportVisibilityFilter(raw: string | null): ExportVisibilityFilter {
  const normalized = String(raw || "").trim().toLowerCase();
  return EXPORT_VISIBILITY_FILTERS.includes(normalized as ExportVisibilityFilter)
    ? (normalized as ExportVisibilityFilter)
    : "all";
}

function parsePage(raw: string | null) {
  const parsed = Number(raw || "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function formatMoney(value: number | null) {
  if (value == null) return "-";
  return BRL_FORMATTER.format(value);
}

function formatClassificationLabel(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
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

function getChannelTabColor(index: number) {
  const palette = [
    { dot: "bg-sky-400", activeBorder: "border-sky-600", activeText: "text-sky-900" },
    { dot: "bg-emerald-500", activeBorder: "border-emerald-600", activeText: "text-emerald-900" },
    { dot: "bg-amber-400", activeBorder: "border-amber-500", activeText: "text-amber-900" },
    { dot: "bg-violet-400", activeBorder: "border-violet-500", activeText: "text-violet-900" },
    { dot: "bg-rose-400", activeBorder: "border-rose-500", activeText: "text-rose-900" },
  ];

  return palette[index % palette.length];
}

function buildBaseItemWhere(params: { q: string; status: string; tagId: string }) {
  const where: any = { AND: [] as any[] };

  if (params.status === "active") where.active = true;
  if (params.status === "inactive") where.active = false;

  if (params.q) {
    where.AND.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
        { ItemSellingInfo: { is: { slug: { contains: params.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (params.tagId) {
    where.AND.push({
      ItemTag: {
        some: {
          tagId: params.tagId,
        },
      },
    });
  }

  if (where.AND.length === 0) delete where.AND;

  return where;
}

function buildSoldItemWhere(cardapioChannelId: string) {
  return {
    canSell: true,
    active: true,
    ItemSellingInfo: {
      is: {
        upcoming: false,
      },
    },
    ItemSellingChannelItem: {
      some: {
        itemSellingChannelId: cardapioChannelId,
        visible: true,
      },
    },
    ItemSellingPriceVariation: {
      some: {
        itemSellingChannelId: cardapioChannelId,
      },
    },
  };
}

function buildPageHref(params: {
  q: string;
  status: string;
  channel: string;
  tagId: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.channel) searchParams.set("channel", params.channel);
  if (params.tagId) searchParams.set("tagId", params.tagId);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  return `/admin/vendas/itens-vendidos?${searchParams.toString()}`;
}

function buildExportHref(params: {
  q: string;
  status: string;
  channel: string;
  tagId: string;
  exportVisibility?: ExportVisibilityFilter;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.channel) searchParams.set("channel", params.channel);
  if (params.tagId) searchParams.set("tagId", params.tagId);
  if (params.exportVisibility && params.exportVisibility !== "all") {
    searchParams.set("exportVisibility", params.exportVisibility);
  }
  return `/admin/vendas/itens-vendidos/export?${searchParams.toString()}`;
}

function mapSellingRow(item: any): SellingRow {
  const channelLink = item.ItemSellingChannelItem?.[0] || null;
  const prices = item.ItemSellingPriceVariation || [];
  const referencePrice =
    prices.find((row: any) => row.ItemVariation?.isReference) ||
    prices[0] ||
    null;
  const upcoming = Boolean(item.ItemSellingInfo?.upcoming);
  const channelVisible = channelLink?.visible === true;
  const commerciallyReady = Boolean(item.canSell) && Boolean(item.active) && channelVisible && !upcoming && prices.length > 0;

  return {
    id: String(item.id),
    name: item.name || "Item sem nome",
    classification: item.classification || "",
    active: Boolean(item.active),
    canSell: Boolean(item.canSell),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
    categoryName: item.Category?.name || null,
    sellingCategoryName: item.ItemSellingInfo?.Category?.name || null,
    groupName: item.ItemSellingInfo?.ItemGroup?.name || null,
    slug: item.ItemSellingInfo?.slug || null,
    upcoming,
    channelVisible,
    totalVariations: (item.ItemVariation || []).length,
    totalPriceEntries: prices.length,
    channelPriceEntries: prices.length,
    referenceVariationName: referencePrice?.ItemVariation?.Variation?.name || null,
    referencePriceAmount: referencePrice ? Number(referencePrice.priceAmount || 0) : null,
    updatedBy: referencePrice?.updatedBy || null,
    commerciallyReady,
  };
}

function resolveDownloadFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replaceAll('"', ""));
  const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || fallback;
}

async function downloadJsonFromHref(href: string) {
  const response = await fetch(href, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let message = "Nao foi possivel gerar o JSON.";
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // Keep fallback message when the server did not return JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = resolveDownloadFilename(
    response.headers.get("Content-Disposition"),
    `itens-vendidos-${new Date().toISOString().slice(0, 10)}.json`
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const tagId = String(url.searchParams.get("tagId") || "").trim();
    const exportFormat = String(url.searchParams.get("export") || "").trim().toLowerCase();
    const exportVisibility = parseExportVisibilityFilter(url.searchParams.get("exportVisibility"));
    const statusParam = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const status = ITEM_STATUS_FILTERS.includes(statusParam as (typeof ITEM_STATUS_FILTERS)[number])
      ? statusParam
      : "active";
    const requestedPage = parsePage(url.searchParams.get("page"));

    const channels = await db.itemSellingChannel.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        sortOrderIndex: true,
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });
    const tags = await db.tag.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });
    const selectedTag = tags.find((tag: any) => String(tag.id) === tagId) || null;

    const selectedChannelKeyParam = String(url.searchParams.get("channel") || "").trim().toLowerCase();
    const selectedChannel =
      channels.find((channel: any) => String(channel.key || "").toLowerCase() === selectedChannelKeyParam) ||
      channels[0] ||
      null;
    const cardapioChannel = channels.find((channel: any) => String(channel.key || "").toLowerCase() === "cardapio") || null;

    const baseWhere = buildBaseItemWhere({ q, status, tagId: selectedTag ? String(selectedTag.id) : "" });
    const soldWhere = cardapioChannel ? buildSoldItemWhere(String(cardapioChannel.id)) : null;

    const channelTabs: SellingChannelTab[] = await Promise.all(
      (channels || []).map(async (channel: any) => ({
        id: String(channel.id),
        key: String(channel.key || "").toLowerCase(),
        name: channel.name || String(channel.key || "").toUpperCase(),
        description: channel.description || null,
        count: await db.item.count({
          where: {
            ...baseWhere,
            ...(soldWhere || {}),
            ItemSellingChannelItem: {
              some: {
                itemSellingChannelId: channel.id,
              },
            },
          },
        }),
      }))
    );

    if (!selectedChannel) {
      return ok({
        filters: {
          q,
          tagId: selectedTag ? String(selectedTag.id) : "",
          tagName: selectedTag?.name || null,
          status,
          channel: null,
          page: 1,
          totalPages: 1,
        },
        tabs: [],
        tags: tags.map((tag: any) => ({
          id: String(tag.id),
          name: tag.name || "Tag sem nome",
        })),
        rows: [],
        summary: {
          totalItems: 0,
          activeForSales: 0,
          visibleInChannel: 0,
          publishedInChannel: 0,
          upcomingItems: 0,
        },
      });
    }

    const where = {
      ...baseWhere,
      ...(soldWhere || {}),
      ItemSellingChannelItem: {
        some: {
          itemSellingChannelId: selectedChannel.id,
        },
      },
    };

    if (exportFormat === "json") {
      return redirect(
        buildExportHref({
          q,
          status,
          channel: String(selectedChannel.key || "").toLowerCase(),
          tagId: selectedTag ? String(selectedTag.id) : "",
          exportVisibility,
        })
      );
    }

    const [totalItems, activeForSales, visibleInChannel, pricedInChannel, upcomingItems] = await Promise.all([
      db.item.count({ where }),
      db.item.count({ where }),
      db.item.count({
        where: {
          ...where,
          ItemSellingChannelItem: {
            some: {
              itemSellingChannelId: selectedChannel.id,
              visible: true,
            },
          },
        },
      }),
      db.item.count({
        where: {
          ...where,
          ItemSellingPriceVariation: {
            some: {
              itemSellingChannelId: selectedChannel.id,
            },
          },
        },
      }),
      db.item.count({
        where: {
          ...where,
          ItemSellingInfo: {
            is: {
              upcoming: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    const items = await db.item.findMany({
      where,
      select: {
        id: true,
        name: true,
        classification: true,
        active: true,
        canSell: true,
        updatedAt: true,
        Category: {
          select: {
            name: true,
          },
        },
        ItemSellingInfo: {
          select: {
            slug: true,
            upcoming: true,
            Category: {
              select: {
                name: true,
              },
            },
            ItemGroup: {
              select: {
                name: true,
              },
            },
          },
        },
        ItemVariation: {
          where: { deletedAt: null },
          select: {
            id: true,
            isReference: true,
            Variation: {
              select: {
                name: true,
              },
            },
          },
        },
        ItemSellingChannelItem: {
          where: {
            itemSellingChannelId: selectedChannel.id,
          },
          select: {
            visible: true,
          },
          take: 1,
        },
        ItemSellingPriceVariation: {
          where: {
            itemSellingChannelId: selectedChannel.id,
          },
          select: {
            id: true,
            priceAmount: true,
            updatedAt: true,
            updatedBy: true,
            ItemVariation: {
              select: {
                isReference: true,
                Variation: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const rows: SellingRow[] = (items || []).map(mapSellingRow);

    return ok({
      filters: {
        q,
        tagId: selectedTag ? String(selectedTag.id) : "",
        tagName: selectedTag?.name || null,
        status,
        channel: String(selectedChannel.key || "").toLowerCase(),
        channelName: selectedChannel.name || String(selectedChannel.key || "").toUpperCase(),
        page,
        totalPages,
      },
      tabs: channelTabs,
      tags: tags.map((tag: any) => ({
        id: String(tag.id),
        name: tag.name || "Tag sem nome",
      })),
      rows,
      summary: {
        totalItems,
        activeForSales,
        visibleInChannel,
        publishedInChannel: pricedInChannel,
        upcomingItems: 0,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasItensVendidosPage() {
  const loaderData = useLoaderData<typeof loader>();
  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  type LoaderPayload = {
    filters: {
      q: string;
      tagId: string;
      tagName?: string | null;
      status: string;
      channel: string | null;
      channelName?: string;
      page: number;
      totalPages: number;
    };
    tabs: SellingChannelTab[];
    tags: TagFilterOption[];
    rows: SellingRow[];
    summary: {
      totalItems: number;
      activeForSales: number;
      visibleInChannel: number;
      publishedInChannel: number;
      upcomingItems: number;
    };
  };
  const rawPayload = (loaderData?.payload || {}) as Partial<LoaderPayload>;
  const payload: LoaderPayload = {
    filters: {
      q: "",
      tagId: "",
      tagName: null,
      status: "active",
      channel: null,
      channelName: "",
      page: 1,
      totalPages: 1,
      ...(rawPayload.filters || {}),
    },
    tabs: Array.isArray(rawPayload.tabs) ? rawPayload.tabs : [],
    tags: Array.isArray(rawPayload.tags) ? rawPayload.tags : [],
    rows: Array.isArray(rawPayload.rows) ? rawPayload.rows : [],
    summary: {
      totalItems: 0,
      activeForSales: 0,
      visibleInChannel: 0,
      publishedInChannel: 0,
      upcomingItems: 0,
      ...(rawPayload.summary || {}),
    },
  };

  const filters = payload.filters;
  const summary = payload.summary;
  const [search, setSearch] = useState(filters.q || "");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const currentChannel = filters.channel || "";
  const currentStatus = filters.status || "active";
  const currentTagId = filters.tagId || "";
  const rows = payload.rows || [];
  const tabs = payload.tabs || [];
  const tags = payload.tags || [];
  const [exportChannel, setExportChannel] = useState(currentChannel || tabs[0]?.key || "");
  const [exportVisibility, setExportVisibility] = useState<ExportVisibilityFilter>("all");
  const [isExporting, setIsExporting] = useState(false);
  const selectedExportTab = tabs.find((tab) => tab.key === exportChannel) || tabs[0] || null;
  const exportHref = selectedExportTab
    ? buildExportHref({
        q: filters.q || "",
        status: currentStatus,
        channel: selectedExportTab.key,
        tagId: currentTagId,
        exportVisibility,
      })
    : "";
  const handleExportJson = async () => {
    if (!exportHref || isExporting) return;
    setIsExporting(true);
    try {
      await downloadJsonFromHref(exportHref);
      setExportDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel baixar o JSON.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (hasLoaderError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loaderData?.message || "Não foi possível carregar a visão de venda."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">vendas</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">Itens vendidos</h1>
              <p className="text-sm text-slate-500">
                Visão comercial dos itens por canal. Aqui o recorte é venda, não estoque.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-9 w-fit gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setExportChannel(currentChannel || tabs[0]?.key || "");
              setExportVisibility("all");
              setExportDialogOpen(true);
            }}
            disabled={tabs.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </Button>
        </div>
      </section>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar itens vendidos</DialogTitle>
            <DialogDescription>
              Selecione o canal de venda para gerar um JSON com os filtros atuais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="export-channel">
              Canal de venda
            </label>
            <Select value={exportChannel} onValueChange={setExportChannel}>
              <SelectTrigger id="export-channel" className="h-10 w-full">
                <SelectValue placeholder="Selecione um canal" />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.key} value={tab.key}>
                    {tab.name} ({tab.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="export-visibility">
              Visibilidade no canal
            </label>
            <Select value={exportVisibility} onValueChange={(value) => setExportVisibility(value as ExportVisibilityFilter)}>
              <SelectTrigger id="export-visibility" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">todos os sabores</SelectItem>
                <SelectItem value="visible">somente visíveis</SelectItem>
                <SelectItem value="hidden">somente ocultos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              O arquivo inclui itens, variações, preços do canal e metadados para análise.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleExportJson} disabled={!exportHref || isExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Gerando..." : "Baixar JSON"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{summary?.totalItems || 0} item(ns)</span>
        <span>·</span>
        <span>{summary?.visibleInChannel || 0} visíveis no canal</span>
        <span>·</span>
        <span>{summary?.publishedInChannel || 0} com preço no canal</span>
        <span>·</span>
        <span>Pág. {filters.page}/{filters.totalPages}</span>
      </div>

      <section className="space-y-4">
        <Form method="get" className="flex flex-wrap items-center gap-6">
          <input type="hidden" name="channel" value={currentChannel} />

          <div className="relative flex min-w-[260px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              id="q"
              name="q"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Pesquise por nome, descrição ou slug"
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

          <Select name="status" defaultValue={currentStatus}>
            <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-blue-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-blue-400">
              <SelectValue>
                {currentStatus === "active" ? "produtos ativos" : currentStatus === "inactive" ? "produtos inativos" : "todos os produtos"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">produtos ativos</SelectItem>
              <SelectItem value="inactive">produtos inativos</SelectItem>
              <SelectItem value="all">todos os produtos</SelectItem>
            </SelectContent>
          </Select>

          <Select name="tagId" defaultValue={currentTagId || "__all__"}>
            <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-slate-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-slate-400">
              <SelectValue>
                {filters?.tagName || "todas as tags"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">todas as tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ListFilter className="h-3.5 w-3.5" />
            <span>filtros</span>
          </button>

          <Link to={`/admin/vendas/itens-vendidos?channel=${currentChannel}`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
            <XCircle className="h-3.5 w-3.5" />
            <span>limpar filtros</span>
          </Link>
        </Form>

        <div className="flex items-end justify-between border-b border-slate-200 px-1">
          <div className="flex">
          {tabs.map((tab, index) => {
            const isActive = tab.key === currentChannel;
            const color = getChannelTabColor(index);
            return (
              <Link
                key={tab.key}
                to={buildPageHref({
                  q: filters?.q || "",
                  status: currentStatus,
                  channel: tab.key,
                  tagId: currentTagId,
                })}
                className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${isActive
                    ? `border-b-2 ${color.activeBorder} ${color.activeText}`
                    : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                <span className={`inline-flex items-center gap-1.5 ${isActive ? "font-semibold" : "font-medium"}`}>
                  <span className={`h-2 w-2 rounded-full ${color.dot} ${isActive ? "" : "opacity-50"}`} />
                  {tab.name} ({tab.count})
                </span>
              </Link>
            );
          })}
          </div>
          <button type="button" className="mb-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Colunas">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden bg-white">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead>Item</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Preço referência</TableHead>
                <TableHead>Publicação</TableHead>
                <TableHead>Estrutura comercial</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-sm text-slate-500">
                    Nenhum item encontrado para este canal com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}

              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-100 align-top hover:bg-slate-50/50">
                  <TableCell className="min-w-[18rem]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/items/${row.id}/venda`} className="font-semibold text-slate-900 hover:underline">
                          {row.name}
                        </Link>
                        {!row.active ? (
                          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                            inativo
                          </Badge>
                        ) : null}
                        {!row.canSell ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            venda off
                          </Badge>
                        ) : null}
                      </div>

                      <div className="text-xs text-slate-500">
                        {row.groupName || row.sellingCategoryName || row.categoryName || "Sem grupo comercial"}
                        {row.slug ? ` · /${row.slug}` : ""}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2 text-sm">
                      <div className="font-medium text-slate-900">{filters.channelName}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={
                            row.channelVisible
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }
                        >
                          {row.channelVisible ? "visível" : "oculto"}
                        </Badge>
                        {row.upcoming ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            lançamento
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{formatMoney(row.referencePriceAmount)}</div>
                      <div className="text-xs text-slate-500">
                        {row.referenceVariationName ? `Base: ${row.referenceVariationName}` : "Sem variação precificada"}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-900">
                        {row.channelPriceEntries}/{row.totalPriceEntries} preço(s) no canal
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          row.commerciallyReady
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }
                      >
                        {row.commerciallyReady ? "item vendido" : "pendência comercial"}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div>{row.totalVariations} variação(ões)</div>
                      <div>{row.totalPriceEntries} entrada(s) de preço</div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div>{formatDate(row.updatedAt)}</div>
                      <div className="text-xs text-slate-500">{row.updatedBy || "Sem usuário registrado"}</div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filters.totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-500">
              {summary.totalItems} item(ns) encontrados.
            </div>

            <Pagination className="mx-0 w-auto justify-start">
              <PaginationContent className="gap-1.5">
              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    tagId: currentTagId,
                    page: 1,
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${filters.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  aria-label="Primeira página"
                >
                  <ChevronsLeft size={16} />
                </PaginationLink>
              </PaginationItem>

              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    tagId: currentTagId,
                    page: Math.max(1, filters.page - 1),
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${filters.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </PaginationLink>
              </PaginationItem>

              {Array.from({ length: filters.totalPages }, (_, index) => index + 1)
                .filter((page) => Math.abs(page - filters.page) <= 2)
                .map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href={buildPageHref({
                        q: filters.q,
                        status: currentStatus,
                        channel: currentChannel,
                        tagId: currentTagId,
                        page,
                      })}
                      className="h-8 min-w-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600 hover:bg-slate-50"
                      isActive={page === filters.page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    tagId: currentTagId,
                    page: Math.min(filters.totalPages, filters.page + 1),
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${filters.page >= filters.totalPages ? "pointer-events-none opacity-40" : ""}`}
                  aria-label="Próxima página"
                >
                  <ChevronsRight size={16} />
                </PaginationLink>
              </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </section>
    </div>
  );
}
