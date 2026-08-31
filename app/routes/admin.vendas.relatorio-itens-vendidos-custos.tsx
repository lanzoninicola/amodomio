import {
  defer,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Form, Link, useLoaderData } from "@remix-run/react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
} from "lucide-react";
import { Suspense } from "react";
import Container from "~/components/layout/container/container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "~/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";

const PAGE_SIZE = 20;

export const meta: MetaFunction = () => [
  { title: "Itens vendidos e custos | Vendas" },
  { name: "robots", content: "noindex" },
];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatCostUpdatedAt(value: string) {
  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) return null;
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000)
  );
  const elapsedLabel =
    elapsedDays === 0
      ? "hoje"
      : elapsedDays === 1
      ? "há 1 dia"
      : `há ${elapsedDays} dias`;
  return `${date.format(updatedAt)} · ${elapsedLabel}`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parsePage(value: string | null) {
  const parsed = Number(value || "1");
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

async function loadReport(request: Request, paginate = true) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const requestedCategoryId = String(
    url.searchParams.get("categoryId") || ""
  ).trim();
  const categoryId = requestedCategoryId === "all" ? "" : requestedCategoryId;
  const status = url.searchParams.get("status") === "all" ? "all" : "active";
  const requestedPage = parsePage(url.searchParams.get("page"));
  const requestedChannelId = String(
    url.searchParams.get("channelId") || ""
  ).trim();

  const channels = await prismaClient.itemSellingChannel.findMany({
    select: { id: true, key: true, name: true },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });
  const selectedChannel =
    channels.find((channel) => channel.id === requestedChannelId) ||
    channels.find((channel) => channel.key.toLowerCase() === "cardapio") ||
    channels[0] ||
    null;

  const [sales, items, categories] = await Promise.all([
    prismaClient.menuEngineeringImportItem.findMany({
      select: { topping: true, quantity: true },
    }),
    prismaClient.item.findMany({
      where: {
        ...(status === "active" ? { active: true, canSell: true } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(selectedChannel
          ? {
              ItemSellingChannelItem: {
                some: {
                  itemSellingChannelId: selectedChannel.id,
                  visible: true,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        active: true,
        canSell: true,
        ItemVariation: {
          where: { deletedAt: null, Variation: { deletedAt: null } },
          select: {
            id: true,
            isReference: true,
            Variation: {
              select: { id: true, name: true, sortOrderIndex: true },
            },
            ItemCostSheet: {
              where: { isActive: true, status: "active" },
              select: { id: true, costAmount: true, updatedAt: true },
              orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prismaClient.category.findMany({
      where: { Items: { some: {} } },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const salesByName = new Map<
    string,
    { quantity: number; sourceName: string }
  >();
  sales.forEach((sale) => {
    const key = normalize(sale.topping);
    const current = salesByName.get(key) ?? {
      quantity: 0,
      sourceName: sale.topping,
    };
    current.quantity += Number(sale.quantity || 0);
    salesByName.set(key, current);
  });

  const variationMap = new Map<
    string,
    { id: string; name: string; sortOrderIndex: number }
  >();
  items.forEach((item) =>
    item.ItemVariation.filter(
      (itemVariation) => itemVariation.ItemCostSheet.length > 0
    ).forEach(({ Variation }) => variationMap.set(Variation.id, Variation))
  );
  const variations = Array.from(variationMap.values()).sort(
    (a, b) =>
      a.sortOrderIndex - b.sortOrderIndex ||
      a.name.localeCompare(b.name, "pt-BR")
  );

  const matchedSales = new Set<string>();
  const allRows = items
    .map((item) => {
      const key = normalize(item.name);
      const sold = salesByName.get(key);
      if (!sold) return null;
      matchedSales.add(key);
      const costs = Object.fromEntries(
        item.ItemVariation.filter(
          (variation) => variation.ItemCostSheet.length > 0
        ).map((variation) => [
          variation.Variation.id,
          variation.ItemCostSheet[0]
            ? {
                amount: Number(variation.ItemCostSheet[0].costAmount || 0),
                updatedAt: variation.ItemCostSheet[0].updatedAt.toISOString(),
                isReference: variation.isReference,
              }
            : null,
        ])
      );
      return {
        id: item.id,
        name: item.name,
        active: item.active,
        canSell: item.canSell,
        quantity: sold.quantity,
        costs,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b?.quantity || 0) - Number(a?.quantity || 0));

  const totalItems = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const rows = paginate
    ? allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : allRows;

  const unmatched = Array.from(salesByName.entries())
    .filter(
      ([key, sold]) =>
        !matchedSales.has(key) &&
        (!q || normalize(sold.sourceName).includes(normalize(q)))
    )
    .map(([key, sold]) => ({ key, ...sold }))
    .sort((a, b) => b.quantity - a.quantity);

  return {
    filters: {
      q,
      categoryId,
      channelId: selectedChannel?.id || "",
      status,
    },
    channels,
    categories,
    variations,
    rows,
    unmatched,
    summary: {
      items: totalItems,
    },
    pagination: { page, pageSize: PAGE_SIZE, totalItems, totalPages },
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  return defer({ report: loadReport(request) });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  if (formData.get("_action") !== "export-xlsx") {
    return new Response("Ação inválida.", { status: 400 });
  }

  const exportUrl = new URL(request.url);
  ["q", "categoryId", "channelId", "status"].forEach((key) => {
    const value = String(formData.get(key) || "").trim();
    if (value) exportUrl.searchParams.set(key, value);
  });
  const data = await loadReport(new Request(exportUrl), false);
  const XLSX = await import("xlsx");
  const columns = [
    "Item",
    ...data.variations.flatMap((variation) => [
      `Custo ${variation.name}`,
      `Atualização ${variation.name}`,
      `Dias ${variation.name}`,
    ]),
  ];
  const now = Date.now();
  const rows = data.rows.map((row) => {
    const record: Record<string, string | number | Date> = {
      Item: row?.name || "",
    };
    data.variations.forEach((variation) => {
      const cost = row?.costs[variation.id];
      record[`Custo ${variation.name}`] = cost?.amount ?? "";
      record[`Atualização ${variation.name}`] = cost
        ? new Date(cost.updatedAt)
        : "";
      record[`Dias ${variation.name}`] = cost
        ? Math.max(
            0,
            Math.floor((now - new Date(cost.updatedAt).getTime()) / 86_400_000)
          )
        : "";
    });
    return record;
  });
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  data.variations.forEach((_, variationIndex) => {
    const costColumn = 1 + variationIndex * 3;
    const updatedColumn = costColumn + 1;
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const costCell =
        sheet[XLSX.utils.encode_cell({ r: rowIndex, c: costColumn })];
      const updatedCell =
        sheet[XLSX.utils.encode_cell({ r: rowIndex, c: updatedColumn })];
      if (costCell) costCell.z = "R$ #,##0.00";
      if (updatedCell) updatedCell.z = "dd/mm/yyyy";
    }
  });
  sheet["!autofilter"] = { ref: sheet["!ref"] || "A1:A1" };
  sheet["!cols"] = columns.map((column, index) => ({
    wch: index === 0 ? 34 : Math.max(14, Math.min(24, column.length + 2)),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Itens e custos");
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellDates: true,
  });
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="itens-vendidos-custos-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    },
  });
}

function buildPageHref(filters: {
  q: string;
  categoryId: string;
  channelId: string;
  status: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();
  if (filters.q) searchParams.set("q", filters.q);
  if (filters.categoryId) searchParams.set("categoryId", filters.categoryId);
  if (filters.channelId) searchParams.set("channelId", filters.channelId);
  if (filters.status !== "active") searchParams.set("status", filters.status);
  if (filters.page > 1) searchParams.set("page", String(filters.page));
  const query = searchParams.toString();
  return `/admin/vendas/relatorio-itens-vendidos-custos${
    query ? `?${query}` : ""
  }`;
}

function LoadingReport() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
      Carregando vendas e custos...
    </div>
  );
}

export default function SoldItemsCostReport() {
  const { report } = useLoaderData<typeof loader>();
  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-3 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/item-cost-sheets"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={14} /> Custos e margem
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-lg font-semibold text-slate-950">
              Itens vendidos e custos
            </h1>
          </div>
        </div>
        <Suspense fallback={<LoadingReport />}>
          <Await
            resolve={report}
            errorElement={
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Não foi possível carregar o relatório.
              </div>
            }
          >
            {(data) => (
              <>
                <div className="border-b border-slate-200 pb-3">
                  <Form
                    method="get"
                    className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_190px_210px_160px_auto] md:items-end"
                  >
                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                      Item
                      <Input
                        name="q"
                        defaultValue={data.filters.q}
                        placeholder="Buscar sabor ou item"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                      Canal de venda
                      <Select
                        name="channelId"
                        defaultValue={data.filters.channelId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                      Categoria
                      <Select
                        name="categoryId"
                        defaultValue={data.filters.categoryId || "all"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as categorias" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            Todas as categorias
                          </SelectItem>
                          {data.categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                      Itens
                      <Select name="status" defaultValue={data.filters.status}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Somente ativos</SelectItem>
                          <SelectItem value="all">Todos os status</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <Button type="submit">
                      <Search size={16} className="mr-2" /> Filtrar
                    </Button>
                  </Form>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">
                      {data.summary.items} item(ns) encontrado(s)
                    </div>
                    <Form method="post" reloadDocument>
                      <input type="hidden" name="_action" value="export-xlsx" />
                      <input type="hidden" name="q" value={data.filters.q} />
                      <input
                        type="hidden"
                        name="categoryId"
                        value={data.filters.categoryId}
                      />
                      <input
                        type="hidden"
                        name="channelId"
                        value={data.filters.channelId}
                      />
                      <input
                        type="hidden"
                        name="status"
                        value={data.filters.status}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        <Download size={14} className="mr-1.5" /> Exportar Excel
                      </Button>
                    </Form>
                  </div>
                </div>
                <div className="overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[760px]">
                      <TableHeader className="bg-slate-50/90">
                        <TableRow className="hover:bg-slate-50/90">
                          <TableHead className="sticky left-0 h-10 min-w-56 bg-slate-50/90 px-4 text-xs font-medium text-slate-500">
                            Item vendido
                          </TableHead>
                          {data.variations.map((variation) => (
                            <TableHead
                              key={variation.id}
                              className="h-10 min-w-36 px-4 text-right text-xs font-medium text-slate-500"
                            >
                              Custo {variation.name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rows.map(
                          (row) =>
                            row && (
                              <TableRow key={row.id}>
                                <TableCell className="sticky left-0 bg-white px-4 py-3 font-medium">
                                  <Link
                                    className="hover:underline"
                                    to={`/admin/items/${row.id}/costs`}
                                  >
                                    {row.name}
                                  </Link>
                                  {!row.active || !row.canSell ? (
                                    <Badge variant="outline" className="ml-2">
                                      Inativo
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                {data.variations.map((variation) => {
                                  const cost = row.costs[variation.id];
                                  return (
                                    <TableCell
                                      key={variation.id}
                                      className="px-4 py-3 text-right tabular-nums"
                                    >
                                      {cost ? (
                                        <div>
                                          <div className="font-medium">
                                            {money.format(cost.amount)}
                                          </div>
                                          <div className="mt-0.5 whitespace-nowrap text-[10px] font-normal text-slate-400">
                                            {formatCostUpdatedAt(
                                              cost.updatedAt
                                            )}
                                          </div>
                                          {cost.isReference ? (
                                            <span className="text-[10px] text-sky-600">
                                              referência
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">
                                          —
                                        </span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            )
                        )}
                        {data.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={1 + data.variations.length}
                              className="h-24 text-center text-slate-500"
                            >
                              Nenhum item vendido encontrado para os filtros.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-slate-500">
                      {data.pagination.totalItems} item(ns) no total
                    </div>
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                      <div className="text-xs font-semibold text-slate-900">
                        Página {data.pagination.page} de{" "}
                        {data.pagination.totalPages}
                      </div>
                      <Pagination className="mx-0 w-auto justify-start">
                        <PaginationContent className="gap-1.5">
                          {[
                            {
                              page: 1,
                              label: "Primeira página",
                              icon: <ChevronsLeft className="h-4 w-4" />,
                            },
                            {
                              page: data.pagination.page - 1,
                              label: "Página anterior",
                              icon: <ChevronLeft className="h-4 w-4" />,
                            },
                            {
                              page: data.pagination.page + 1,
                              label: "Próxima página",
                              icon: (
                                <ChevronLeft className="h-4 w-4 rotate-180" />
                              ),
                            },
                            {
                              page: data.pagination.totalPages,
                              label: "Última página",
                              icon: <ChevronsRight className="h-4 w-4" />,
                            },
                          ].map((control, index) => {
                            const disabled =
                              control.page < 1 ||
                              control.page > data.pagination.totalPages ||
                              control.page === data.pagination.page;
                            return (
                              <PaginationItem key={`${control.label}-${index}`}>
                                <PaginationLink
                                  href={
                                    disabled
                                      ? "#"
                                      : buildPageHref({
                                          ...data.filters,
                                          page: control.page,
                                        })
                                  }
                                  className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                                    disabled
                                      ? "pointer-events-none opacity-40"
                                      : ""
                                  }`}
                                  aria-label={control.label}
                                >
                                  {control.icon}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                        </PaginationContent>
                      </Pagination>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <strong>Como ler os custos:</strong> cada coluna mostra o
                    custo unitário da ficha ativa atual daquela variação. São
                    exibidas somente variações com ficha ativa.
                    {data.unmatched.length ? (
                      <div className="mt-2">
                        {data.unmatched.length} nome(s) importado(s) não têm
                        correspondência exata no cadastro atual.
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </Await>
        </Suspense>
      </div>
    </Container>
  );
}
