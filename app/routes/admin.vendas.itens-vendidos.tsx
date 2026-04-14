import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ArrowUpDown, ChevronLeft, ChevronsLeft, ChevronsRight, ListFilter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "~/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

const PAGE_SIZE = 20;
const ITEM_STATUS_FILTERS = ["active", "inactive", "all"] as const;
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type SellingChannelTab = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  count: number;
};

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
  publishedPriceEntries: number;
  referenceVariationName: string | null;
  referencePriceAmount: number | null;
  updatedBy: string | null;
  commerciallyReady: boolean;
};

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

function buildBaseItemWhere(params: { q: string; status: string }) {
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
        published: true,
      },
    },
  };
}

function buildPageHref(params: {
  q: string;
  status: string;
  channel: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.channel) searchParams.set("channel", params.channel);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  return `/admin/vendas/itens-vendidos?${searchParams.toString()}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
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

    const selectedChannelKeyParam = String(url.searchParams.get("channel") || "").trim().toLowerCase();
    const selectedChannel =
      channels.find((channel: any) => String(channel.key || "").toLowerCase() === selectedChannelKeyParam) ||
      channels[0] ||
      null;
    const cardapioChannel = channels.find((channel: any) => String(channel.key || "").toLowerCase() === "cardapio") || null;

    const baseWhere = buildBaseItemWhere({ q, status });
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
          status,
          channel: null,
          page: 1,
          totalPages: 1,
        },
        tabs: [],
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

    const [totalItems, activeForSales, visibleInChannel, publishedInChannel, upcomingItems] = await Promise.all([
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
              published: true,
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
            published: true,
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

    const rows: SellingRow[] = (items || []).map((item: any) => {
      const channelLink = item.ItemSellingChannelItem?.[0] || null;
      const prices = item.ItemSellingPriceVariation || [];
      const publishedPrices = prices.filter((row: any) => row.published);
      const referencePrice =
        prices.find((row: any) => row.ItemVariation?.isReference) ||
        publishedPrices.find((row: any) => row.ItemVariation?.isReference) ||
        publishedPrices[0] ||
        prices[0] ||
        null;
      const upcoming = Boolean(item.ItemSellingInfo?.upcoming);
      const channelVisible = channelLink?.visible === true;
      const commerciallyReady = true;

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
        publishedPriceEntries: publishedPrices.length,
        referenceVariationName: referencePrice?.ItemVariation?.Variation?.name || null,
        referencePriceAmount: referencePrice ? Number(referencePrice.priceAmount || 0) : null,
        updatedBy: referencePrice?.updatedBy || null,
        commerciallyReady,
      };
    });

    return ok({
      filters: {
        q,
        status,
        channel: String(selectedChannel.key || "").toLowerCase(),
        channelName: selectedChannel.name || String(selectedChannel.key || "").toUpperCase(),
        page,
        totalPages,
      },
      tabs: channelTabs,
      rows,
      summary: {
        totalItems,
        activeForSales,
        visibleInChannel,
        publishedInChannel,
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
  const payload = (loaderData?.payload || {}) as {
    filters: {
      q: string;
      status: string;
      channel: string | null;
      channelName?: string;
      page: number;
      totalPages: number;
    };
    tabs: SellingChannelTab[];
    rows: SellingRow[];
    summary: {
      totalItems: number;
      activeForSales: number;
      visibleInChannel: number;
      publishedInChannel: number;
      upcomingItems: number;
    };
  };

  const [search, setSearch] = useState(payload.filters?.q || "");

  const currentChannel = payload.filters?.channel || "";
  const currentStatus = payload.filters?.status || "active";
  const rows = payload.rows || [];
  const tabs = payload.tabs || [];

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
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{payload.summary?.totalItems || 0} item(ns)</span>
        <span>·</span>
        <span>{payload.summary?.visibleInChannel || 0} visíveis no canal</span>
        <span>·</span>
        <span>{payload.summary?.publishedInChannel || 0} com preço publicado</span>
        <span>·</span>
        <span>Pág. {payload.filters.page}/{payload.filters.totalPages}</span>
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
                  q: payload.filters?.q || "",
                  status: currentStatus,
                  channel: tab.key,
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
                      <div className="font-medium text-slate-900">{payload.filters.channelName}</div>
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
                        {row.publishedPriceEntries}/{row.totalPriceEntries} preço(s) publicado(s)
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

        {payload.filters.totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-500">
              {payload.summary.totalItems} item(ns) encontrados.
            </div>

            <Pagination className="mx-0 w-auto justify-start">
              <PaginationContent className="gap-1.5">
              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: payload.filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    page: 1,
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${payload.filters.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  aria-label="Primeira página"
                >
                  <ChevronsLeft size={16} />
                </PaginationLink>
              </PaginationItem>

              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: payload.filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    page: Math.max(1, payload.filters.page - 1),
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${payload.filters.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </PaginationLink>
              </PaginationItem>

              {Array.from({ length: payload.filters.totalPages }, (_, index) => index + 1)
                .filter((page) => Math.abs(page - payload.filters.page) <= 2)
                .map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href={buildPageHref({
                        q: payload.filters.q,
                        status: currentStatus,
                        channel: currentChannel,
                        page,
                      })}
                      className="h-8 min-w-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600 hover:bg-slate-50"
                      isActive={page === payload.filters.page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

              <PaginationItem>
                <PaginationLink
                  href={buildPageHref({
                    q: payload.filters.q,
                    status: currentStatus,
                    channel: currentChannel,
                    page: Math.min(payload.filters.totalPages, payload.filters.page + 1),
                  })}
                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${payload.filters.page >= payload.filters.totalPages ? "pointer-events-none opacity-40" : ""}`}
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
