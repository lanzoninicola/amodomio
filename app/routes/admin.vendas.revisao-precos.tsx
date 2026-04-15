import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  computeNativeItemSellingPriceBreakdown,
  listSizeMapByKey,
  pickLatestActiveSheet,
  resolveVariationSizeKey,
} from "~/domain/item/item-selling-price-calculation.server";
import { ok, serverError } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

const ALL_OPTION = "__all__";
const PRICE_TOLERANCE = 0.05;

type ReviewStatus = "raise-price" | "lower-price" | "ok" | "missing-sheet";

type ReviewRow = {
  id: string;
  itemId: string;
  itemName: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  itemVariationId: string;
  variationName: string;
  variationCode: string | null;
  priceAmount: number;
  currentCostAmount: number | null;
  savedProfitActualPerc: number;
  recalculatedProfitActualPerc: number | null;
  targetMarginPerc: number;
  recommendedPriceAmount: number | null;
  priceGapAmount: number | null;
  marginGapPerc: number | null;
  visibleForChannel: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  status: ReviewStatus;
};

function formatMoney(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value: number | null) {
  if (value == null) return "-";
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function resolveStatus(params: {
  hasActiveSheet: boolean;
  priceGapAmount: number | null;
}) {
  if (!params.hasActiveSheet) return "missing-sheet" as const;
  const gap = Number(params.priceGapAmount || 0);
  if (gap > PRICE_TOLERANCE) return "raise-price" as const;
  if (gap < -PRICE_TOLERANCE) return "lower-price" as const;
  return "ok" as const;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const statusParam = String(url.searchParams.get("status") || "").trim();
    const channelIdParam = String(url.searchParams.get("channelId") || "").trim();
    const variationIdParam = String(url.searchParams.get("variationId") || "").trim();
    const onlyVisibleParam = String(url.searchParams.get("onlyVisible") || "").trim();

    const [channels, variations, sellingPriceConfig, sizeMap] = await Promise.all([
      db.itemSellingChannel.findMany({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
          targetMarginPerc: true,
        },
      }),
      db.variation.findMany({
        where: {
          kind: "size",
          deletedAt: null,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          sortOrderIndex: true,
        },
      }),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
      listSizeMapByKey(),
    ]);

    const defaultChannelId = channels.find((channel: any) => channel.key === "cardapio")?.id || "";
    const defaultVariationId =
      variations.find((variation: any) => variation.code === "pizza-medium")?.id || "";
    const hasChannelParam = url.searchParams.has("channelId");
    const hasVariationParam = url.searchParams.has("variationId");
    const selectedChannelId =
      channelIdParam === ALL_OPTION
        ? ""
        : hasChannelParam
          ? channelIdParam
          : defaultChannelId;
    const selectedVariationId =
      variationIdParam === ALL_OPTION
        ? ""
        : hasVariationParam
          ? variationIdParam
          : defaultVariationId;
    const selectedVariationCode =
      variations.find((variation: any) => String(variation.id || "") === String(selectedVariationId || ""))?.code || "";
    const onlyVisible = onlyVisibleParam !== "false";

    const priceRows = await db.itemSellingPriceVariation.findMany({
      where: {
        published: true,
        ...(selectedChannelId ? { itemSellingChannelId: selectedChannelId } : {}),
      },
      select: {
        id: true,
        itemId: true,
        itemVariationId: true,
        itemSellingChannelId: true,
        priceAmount: true,
        profitActualPerc: true,
        publishedAt: true,
        updatedAt: true,
        updatedBy: true,
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
            Variation: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        ItemSellingChannel: {
          select: {
            id: true,
            key: true,
            name: true,
            targetMarginPerc: true,
            taxPerc: true,
            feeAmount: true,
            isMarketplace: true,
            onlinePaymentTaxPerc: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const itemIds = Array.from(new Set((priceRows || []).map((row: any) => String(row.itemId || "")).filter(Boolean)));
    const channelIds = Array.from(
      new Set((priceRows || []).map((row: any) => String(row.itemSellingChannelId || "")).filter(Boolean))
    );

    const [channelLinks, activeSheets] = await Promise.all([
      itemIds.length && channelIds.length
        ? db.itemSellingChannelItem.findMany({
          where: {
            itemId: { in: itemIds },
            itemSellingChannelId: { in: channelIds },
          },
          select: {
            itemId: true,
            itemSellingChannelId: true,
            visible: true,
          },
        })
        : [],
      itemIds.length
        ? db.itemCostSheet.findMany({
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
        })
        : [],
    ]);

    const channelLinkByKey = new Map<string, boolean>();
    for (const row of channelLinks || []) {
      channelLinkByKey.set(
        `${String(row.itemId || "")}:${String(row.itemSellingChannelId || "")}`,
        row.visible === true
      );
    }

    const activeSheetsByVariation = new Map<string, any[]>();
    for (const sheet of activeSheets || []) {
      const key = `${String(sheet.itemId || "")}:${String(sheet.itemVariationId || "")}`;
      const current = activeSheetsByVariation.get(key) || [];
      current.push(sheet);
      activeSheetsByVariation.set(key, current);
    }

    let rows: ReviewRow[] = (priceRows || []).map((row: any) => {
      const itemId = String(row.Item?.id || row.itemId || "").trim();
      const itemVariationId = String(row.ItemVariation?.id || row.itemVariationId || "").trim();
      const channelId = String(row.ItemSellingChannel?.id || row.itemSellingChannelId || "").trim();
      const activeSheet = pickLatestActiveSheet(
        activeSheetsByVariation.get(`${itemId}:${itemVariationId}`) || []
      );
      const sizeKey = resolveVariationSizeKey({
        variationCode: row.ItemVariation?.Variation?.code,
        variationName: row.ItemVariation?.Variation?.name,
      });
      const size = sizeKey ? sizeMap.get(sizeKey) || null : null;
      const visibleForChannel =
        channelLinkByKey.get(`${itemId}:${channelId}`) === true;
      const isActuallyPublic =
        Boolean(row.Item?.canSell) &&
        Boolean(row.Item?.active) &&
        visibleForChannel &&
        row.Item?.ItemSellingInfo?.upcoming !== true;

      const breakdown = activeSheet
        ? computeNativeItemSellingPriceBreakdown({
          channel: row.ItemSellingChannel,
          itemCostAmount: Number(activeSheet.costAmount || 0),
          sellingPriceConfig,
          size,
        })
        : null;

      const recalculatedProfitActualPerc = breakdown
        ? menuItemSellingPriceUtilityEntity.calculateProfitPercFromSellingPrice(
          Number(row.priceAmount || 0),
          {
            fichaTecnicaCostAmount: breakdown.custoFichaTecnica,
            packagingCostAmount: breakdown.packagingCostAmount,
            doughCostAmount: breakdown.doughCostAmount,
            wasteCostAmount: breakdown.wasteCost,
          },
          breakdown.dnaPercentage ?? 0
        )
        : null;

      const recommendedPriceAmount = breakdown?.minimumPrice?.priceAmount?.withProfit ?? null;
      const priceGapAmount =
        recommendedPriceAmount == null
          ? null
          : Number((recommendedPriceAmount - Number(row.priceAmount || 0)).toFixed(2));
      const marginGapPerc =
        recalculatedProfitActualPerc == null
          ? null
          : Number(
            (Number(row.ItemSellingChannel?.targetMarginPerc || 0) - recalculatedProfitActualPerc).toFixed(2)
          );

      return {
        id: String(row.id || ""),
        itemId,
        itemName: row.Item?.name || "Item sem nome",
        channelId,
        channelKey: String(row.ItemSellingChannel?.key || "").trim().toLowerCase(),
        channelName:
          row.ItemSellingChannel?.name || String(row.ItemSellingChannel?.key || "").trim().toUpperCase(),
        itemVariationId,
        variationName: row.ItemVariation?.Variation?.name || "Sem variação",
        variationCode: row.ItemVariation?.Variation?.code || null,
        priceAmount: Number(row.priceAmount || 0),
        currentCostAmount: activeSheet ? Number(activeSheet.costAmount || 0) : null,
        savedProfitActualPerc: Number(row.profitActualPerc || 0),
        recalculatedProfitActualPerc,
        targetMarginPerc: Number(row.ItemSellingChannel?.targetMarginPerc || 0),
        recommendedPriceAmount,
        priceGapAmount,
        marginGapPerc,
        visibleForChannel: isActuallyPublic,
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        updatedBy: row.updatedBy || null,
        status: resolveStatus({
          hasActiveSheet: Boolean(activeSheet?.id),
          priceGapAmount,
        }),
      };
    });

    if (onlyVisible) {
      rows = rows.filter((row) => row.visibleForChannel);
    }

    if (selectedVariationCode) {
      rows = rows.filter((row) => {
        const normalizedVariationCode = resolveVariationSizeKey({
          variationCode: row.variationCode,
          variationName: row.variationName,
        });
        return normalizedVariationCode === selectedVariationCode;
      });
    }

    if (q) {
      const query = q.toLowerCase();
      rows = rows.filter((row) =>
        [row.itemName, row.variationName, row.variationCode || "", row.channelName, row.channelKey]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    if (statusParam && statusParam !== ALL_OPTION) {
      rows = rows.filter((row) => row.status === statusParam);
    }

    rows.sort((a, b) => {
      const gapA = Math.abs(Number(a.priceGapAmount || 0));
      const gapB = Math.abs(Number(b.priceGapAmount || 0));
      if (gapA !== gapB) return gapB - gapA;
      if (a.itemName !== b.itemName) return a.itemName.localeCompare(b.itemName, "pt-BR");
      return a.variationName.localeCompare(b.variationName, "pt-BR");
    });

    const summary = {
      total: rows.length,
      raisePrice: rows.filter((row) => row.status === "raise-price").length,
      lowerPrice: rows.filter((row) => row.status === "lower-price").length,
      ok: rows.filter((row) => row.status === "ok").length,
      missingSheet: rows.filter((row) => row.status === "missing-sheet").length,
    };

    return ok({
      rows,
      summary,
      channels,
      variations,
      filters: {
        q,
        status: statusParam || ALL_OPTION,
        channelId: selectedChannelId || (hasChannelParam ? ALL_OPTION : defaultChannelId),
        variationId:
          selectedVariationId || (hasVariationParam ? ALL_OPTION : defaultVariationId),
        onlyVisible,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasRevisaoPrecosPage() {
  const data = useLoaderData<typeof loader>();
  const payload = (data?.payload || {}) as {
    rows: ReviewRow[];
    summary: {
      total: number;
      raisePrice: number;
      lowerPrice: number;
      ok: number;
      missingSheet: number;
    };
    channels: Array<{ id: string; name: string; key: string }>;
    variations: Array<{ id: string; name: string; code: string }>;
    filters: {
      q: string;
      status: string;
      channelId: string;
      variationId: string;
      onlyVisible: boolean;
    };
  };
  const navigation = useNavigation();
  const rows = payload.rows || [];
  const summary = payload.summary;
  const channels = payload.channels || [];
  const variations = payload.variations || [];
  const filters = payload.filters;
  const isLoading = navigation.state !== "idle";

  return (
    <div className="flex w-full flex-col gap-6 ">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Revisão de preços
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Mostra itens publicados no canal de venda usando apenas o modelo nativo de
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">Item*</code>.
            A margem é recalculada em tempo real com base na ficha ativa da variação.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
          <div className="font-semibold text-slate-700">Regra</div>
          <p className="mt-2 leading-6">
            Se o preço atual ficar abaixo do preço recomendado calculado com o custo atual da
            ficha, o item entra como ajuste para cima. Se ficar acima, entra como ajuste para
            baixo. Diferenças de até {formatMoney(PRICE_TOLERANCE)} ficam como ok.
          </p>
        </div>
      </div>

      <Separator />

      <Form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-4">
          <span className="text-slate-600">Buscar item ou variação</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-slate-300"
            placeholder="Ex.: margherita, media"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Canal</span>
          <select
            name="channelId"
            defaultValue={filters.channelId || ALL_OPTION}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none"
          >
            <option value={ALL_OPTION}>Todos os canais</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Variação</span>
          <select
            name="variationId"
            defaultValue={filters.variationId || ALL_OPTION}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none"
          >
            <option value={ALL_OPTION}>Todas as variações</option>
            {variations.map((variation) => (
              <option key={variation.id} value={variation.id}>
                {variation.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Status</span>
          <select
            name="status"
            defaultValue={filters.status || ALL_OPTION}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none"
          >
            <option value={ALL_OPTION}>Todos</option>
            <option value="raise-price">Ajustar para cima</option>
            <option value="lower-price">Ajustar para baixo</option>
            <option value="ok">Ok</option>
            <option value="missing-sheet">Sem ficha</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-2">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="onlyVisible"
              value="true"
              defaultChecked={Boolean(filters.onlyVisible)}
            />
            Só visíveis
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white"
          >
            {isLoading ? "Atualizando..." : "Filtrar"}
          </button>
        </div>
      </Form>

      <div className="grid gap-6 md:grid-cols-5">
        <MetricCard title="Linhas" value={String(summary?.total || 0)} />
        <MetricCard title="Subir preço" value={String(summary?.raisePrice || 0)} />
        <MetricCard title="Baixar preço" value={String(summary?.lowerPrice || 0)} />
        <MetricCard title="Ok" value={String(summary?.ok || 0)} />
        <MetricCard title="Sem ficha" value={String(summary?.missingSheet || 0)} />
      </div>

      <Separator />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Preço atual</TableHead>
              <TableHead className="text-right">Custo ficha</TableHead>
              <TableHead className="text-right">Margem antiga</TableHead>
              <TableHead className="text-right">Nova margem</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Preço recomendado</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-slate-500">
                  Nenhum item publicado encontrado para os filtros informados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top">
                    <div className="font-medium text-slate-900">
                      <Link to={`/admin/items/${row.itemId}/venda/precos`} className="hover:underline">
                        {row.itemName}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.variationName}
                      {row.variationCode ? ` · ${row.variationCode}` : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Atualizado em {formatDate(row.updatedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium text-slate-900">{row.channelName}</div>
                    <div className="text-xs text-slate-500">
                      {row.visibleForChannel ? "Publicado e visível" : "Publicado fora da vitrine"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(row.priceAmount)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.currentCostAmount)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.savedProfitActualPerc)}</TableCell>
                  <TableCell className="text-right">
                    <div>{formatPercent(row.recalculatedProfitActualPerc)}</div>
                    <div className="text-xs text-slate-500">
                      delta {formatPercent(
                        row.recalculatedProfitActualPerc == null
                          ? null
                          : Number(
                            (
                              row.recalculatedProfitActualPerc - row.savedProfitActualPerc
                            ).toFixed(2)
                          )
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(row.targetMarginPerc)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.recommendedPriceAmount)}</TableCell>
                  <TableCell className="text-right">
                    <GapCell row={row} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="px-1 py-1">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function GapCell({ row }: { row: ReviewRow }) {
  if (row.status === "missing-sheet") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        Sem ficha
      </span>
    );
  }

  if (row.priceGapAmount == null) {
    return "-";
  }

  if (row.status === "raise-price") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-rose-700">
        <ArrowUp className="h-4 w-4" />
        {formatMoney(row.priceGapAmount)}
      </span>
    );
  }

  if (row.status === "lower-price") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-blue-700">
        <ArrowDown className="h-4 w-4" />
        {formatMoney(Math.abs(row.priceGapAmount))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <Minus className="h-4 w-4" />
      {formatMoney(Math.abs(row.priceGapAmount))}
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "raise-price") {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
        Ajustar para cima
      </span>
    );
  }

  if (status === "lower-price") {
    return (
      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
        Ajustar para baixo
      </span>
    );
  }

  if (status === "missing-sheet") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Sem ficha
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
      Ok
    </span>
  );
}
