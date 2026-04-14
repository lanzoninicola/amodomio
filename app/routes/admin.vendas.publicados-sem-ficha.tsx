import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { pickLatestActiveSheet } from "~/domain/item/item-selling-price-calculation.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

type PublicationGapRow = {
  priceId: string;
  itemId: string;
  itemName: string;
  itemCanSell: boolean;
  itemActive: boolean;
  upcoming: boolean;
  itemVariationId: string;
  variationName: string;
  variationCode: string | null;
  isReference: boolean;
  channelKey: string;
  channelName: string;
  visibleForChannel: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  priceAmount: number;
  activeSheetId: string | null;
  isActuallyPublic: boolean;
};

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    if (typeof db.itemSellingPriceVariation?.findMany !== "function") {
      return badRequest("Modelo ItemSellingPriceVariation não disponível no Prisma Client desta execução.");
    }

    const trackedChannelKeys = ["cardapio", "ecommerce"];
    const publishedRows = await db.itemSellingPriceVariation.findMany({
      where: {
        published: true,
        ItemSellingChannel: {
          key: { in: trackedChannelKeys },
        },
      },
      select: {
        id: true,
        itemId: true,
        itemVariationId: true,
        itemSellingChannelId: true,
        priceAmount: true,
        publishedAt: true,
        updatedAt: true,
        updatedBy: true,
        ItemSellingChannel: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        Item: {
          select: {
            id: true,
            name: true,
            canSell: true,
            active: true,
            ItemSellingInfo: {
              select: {
                upcoming: true,
              },
            },
          },
        },
        ItemVariation: {
          select: {
            id: true,
            isReference: true,
            Variation: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const itemIds = Array.from(
      new Set(
        (publishedRows || [])
          .map((row: any) => String(row.itemId || "").trim())
          .filter(Boolean)
      )
    );

    const channelIds = Array.from(
      new Set(
        (publishedRows || [])
          .map((row: any) => String(row.itemSellingChannelId || "").trim())
          .filter(Boolean)
      )
    );

    const [channelLinks, activeSheets] = await Promise.all([
      itemIds.length === 0 || channelIds.length === 0
        ? []
        : db.itemSellingChannelItem.findMany({
            where: {
              itemId: { in: itemIds },
              itemSellingChannelId: { in: channelIds },
            },
            select: {
              itemId: true,
              itemSellingChannelId: true,
              visible: true,
            },
          }),
      itemIds.length === 0
        ? []
        : db.itemCostSheet.findMany({
            where: {
              itemId: { in: itemIds },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              itemId: true,
              itemVariationId: true,
              costAmount: true,
              updatedAt: true,
              activatedAt: true,
            },
            orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
          }),
    ]);

    const channelLinkByKey = new Map<string, { visible: boolean }>();
    for (const row of channelLinks || []) {
      channelLinkByKey.set(
        `${String(row.itemId || "")}:${String(row.itemSellingChannelId || "")}`,
        { visible: row.visible === true }
      );
    }

    const activeSheetsByVariation = new Map<string, any[]>();
    for (const sheet of activeSheets || []) {
      const key = `${String(sheet.itemId || "")}:${String(sheet.itemVariationId || "")}`;
      const current = activeSheetsByVariation.get(key) || [];
      current.push(sheet);
      activeSheetsByVariation.set(key, current);
    }

    const rows: PublicationGapRow[] = (publishedRows || [])
      .map((row: any) => {
        const itemId = String(row.Item?.id || row.itemId || "").trim();
        const itemVariationId = String(row.ItemVariation?.id || row.itemVariationId || "").trim();
        const channelId = String(row.ItemSellingChannel?.id || row.itemSellingChannelId || "").trim();
        const activeSheet = pickLatestActiveSheet(
          activeSheetsByVariation.get(`${itemId}:${itemVariationId}`) || []
        );
        const visibleForChannel =
          channelLinkByKey.get(`${itemId}:${channelId}`)?.visible === true;
        const upcoming = Boolean(row.Item?.ItemSellingInfo?.upcoming);

        return {
          priceId: String(row.id || ""),
          itemId,
          itemName: row.Item?.name || "Item sem nome",
          itemCanSell: Boolean(row.Item?.canSell),
          itemActive: Boolean(row.Item?.active),
          upcoming,
          itemVariationId,
          variationName: row.ItemVariation?.Variation?.name || "Sem variação",
          variationCode: row.ItemVariation?.Variation?.code || null,
          isReference: Boolean(row.ItemVariation?.isReference),
          channelKey: String(row.ItemSellingChannel?.key || "").trim().toLowerCase(),
          channelName: row.ItemSellingChannel?.name || String(row.ItemSellingChannel?.key || "").toUpperCase(),
          visibleForChannel,
          publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
          updatedBy: row.updatedBy || null,
          priceAmount: Number(row.priceAmount || 0),
          activeSheetId: activeSheet?.id || null,
          isActuallyPublic:
            Boolean(row.Item?.canSell) &&
            Boolean(row.Item?.active) &&
            visibleForChannel &&
            !upcoming,
        };
      })
      .filter((row) => !row.activeSheetId && row.isActuallyPublic)
      .sort((a, b) => {
        if (a.channelKey !== b.channelKey) return a.channelKey.localeCompare(b.channelKey, "pt-BR");
        if (a.itemName !== b.itemName) return a.itemName.localeCompare(b.itemName, "pt-BR");
        return a.variationName.localeCompare(b.variationName, "pt-BR");
      });

    return ok({
      rows,
      summary: {
        total: rows.length,
        cardapio: rows.filter((row) => row.channelKey === "cardapio").length,
        ecommerce: rows.filter((row) => row.channelKey === "ecommerce").length,
        actuallyPublic: rows.filter((row) => row.isActuallyPublic).length,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminSellPriceManagementPublishedWithoutCostSheetPage() {
  const loaderData = useLoaderData<typeof loader>();
  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  const payload = (loaderData?.payload || {}) as {
    rows?: PublicationGapRow[];
    summary?: {
      total: number;
      cardapio: number;
      ecommerce: number;
      actuallyPublic: number;
    };
  };

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "cardapio" | "ecommerce">("all");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (payload.rows || []).filter((row) => {
      if (channelFilter !== "all" && row.channelKey !== channelFilter) return false;
      if (!normalizedSearch) return true;
      return [
        row.itemName,
        row.itemId,
        row.variationName,
        row.variationCode || "",
        row.channelName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [channelFilter, payload.rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Publicados sem ficha técnica</h2>
              <p className="text-sm text-slate-500">
                Variações com preço publicado em cardápio ou ecommerce sem ficha técnica ativa vinculada.
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-[280px] grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{payload.summary?.total || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cardápio</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{payload.summary?.cardapio || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ecommerce</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{payload.summary?.ecommerce || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Visíveis agora</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{payload.summary?.actuallyPublic || 0}</div>
          </div>
        </div>
      </div>

      {hasLoaderError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loaderData?.message || "Falha ao carregar a tela."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar item, variação, canal ou id"
            />
            <Select value={channelFilter} onValueChange={(value: "all" | "cardapio" | "ecommerce") => setChannelFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="cardapio">Cardápio</SelectItem>
                <SelectItem value="ecommerce">Ecommerce</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Item</TableHead>
                  <TableHead>Variação</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Publicado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      Nenhuma publicação sem ficha técnica encontrada para o filtro atual.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.priceId} className="align-top">
                      <TableCell className="space-y-1">
                        <div className="font-medium text-slate-900">{row.itemName}</div>
                        <div className="text-xs text-slate-500">{row.itemId}</div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="text-sm text-slate-900">
                          {row.isReference ? `${row.variationName} · referência` : row.variationName}
                        </div>
                        <div className="text-xs text-slate-500">{row.variationCode || "sem código"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.channelKey === "cardapio"
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-violet-200 bg-violet-50 text-violet-700"
                          }
                        >
                          {row.channelName}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-900">{formatMoney(row.priceAmount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={
                              row.isActuallyPublic
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            }
                          >
                            {row.isActuallyPublic ? "Publicado visível" : "Publicado com bloqueio"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              row.visibleForChannel
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }
                          >
                            {row.visibleForChannel ? "Canal visível" : "Canal oculto"}
                          </Badge>
                          {!row.itemCanSell ? (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                              Venda off
                            </Badge>
                          ) : null}
                          {!row.itemActive ? (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                              Item inativo
                            </Badge>
                          ) : null}
                          {row.upcoming ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                              Lançamento futuro
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="space-y-1 text-xs text-slate-500">
                        <div>{formatDate(row.publishedAt || row.updatedAt)}</div>
                        {row.updatedBy ? <div>por {row.updatedBy}</div> : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-2 text-xs">
                          <Link
                            to={`/admin/gerenciamento/cardapio/sell-price-management/${row.channelKey}/edit-items`}
                            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                          >
                            Ajustar preço/canal
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Link
                            to={`/admin/items/${row.itemId}/item-cost-sheets`}
                            className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                          >
                            Abrir fichas do item
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Link
                            to={`/admin/item-cost-sheets/new?itemId=${row.itemId}`}
                            className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                          >
                            Criar ficha
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
