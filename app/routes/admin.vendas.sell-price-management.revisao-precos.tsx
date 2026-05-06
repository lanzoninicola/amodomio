import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { AlertTriangle, ArrowDown, ArrowUp, CircleHelp, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  computeNativeItemSellingPriceBreakdown,
  listSizeMapByKey,
  pickLatestActiveSheet,
  resolveVariationSizeKey,
} from "~/domain/item/item-selling-price-calculation.server";
import {
  buildSellingPriceReviewMetrics,
  SELLING_PRICE_REVIEW_PRICE_TOLERANCE,
  type SellingPriceReviewStatus,
} from "~/domain/item/item-selling-price-review";
import { ok, serverError } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
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

const ALL_OPTION = "__all__";
const PRICE_TOLERANCE = SELLING_PRICE_REVIEW_PRICE_TOLERANCE;

export const meta: MetaFunction = () => [
  { title: "Vendas | Revisão de preços" },
];

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
  recalculatedProfitActualPerc: number | null;
  targetMarginPerc: number;
  recommendedPriceAmount: number | null;
  priceGapAmount: number | null;
  marginGapPerc: number | null;
  visibleForChannel: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  status: SellingPriceReviewStatus;
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

    const selectedChannelId =
      channelIdParam === ALL_OPTION
        ? ""
        : channelIdParam;
    const selectedVariationId =
      variationIdParam === ALL_OPTION
        ? ""
        : variationIdParam;
    const onlyVisible = onlyVisibleParam !== "false";

    const priceRows = await db.itemSellingPriceVariation.findMany({
      where: {
        ...(selectedChannelId ? { itemSellingChannelId: selectedChannelId } : {}),
        ...(selectedVariationId ? { ItemVariation: { variationId: selectedVariationId } } : {}),
      },
      select: {
        id: true,
        itemId: true,
        itemVariationId: true,
        itemSellingChannelId: true,
        priceAmount: true,
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

      const metrics = buildSellingPriceReviewMetrics({
        priceAmount: Number(row.priceAmount || 0),
        breakdown,
        hasActiveSheet: Boolean(activeSheet?.id),
      });

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
        recalculatedProfitActualPerc: metrics.recalculatedProfitActualPerc,
        targetMarginPerc: Number(row.ItemSellingChannel?.targetMarginPerc || 0),
        recommendedPriceAmount: metrics.recommendedPriceAmount,
        priceGapAmount: metrics.priceGapAmount,
        marginGapPerc: metrics.marginGapPerc,
        visibleForChannel: isActuallyPublic,
        publishedAt: null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        updatedBy: row.updatedBy || null,
        status: metrics.status,
      };
    });

    if (onlyVisible) {
      rows = rows.filter((row) => row.visibleForChannel);
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

    const summary = {
      total: rows.length,
      raisePrice: rows.filter((row) => row.status === "raise-price").length,
      lowerPrice: rows.filter((row) => row.status === "lower-price").length,
      ok: rows.filter((row) => row.status === "ok").length,
      missingSheet: rows.filter((row) => row.status === "missing-sheet").length,
    };

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

    return ok({
      rows,
      summary,
      channels,
      variations,
      filters: {
        q,
        status: statusParam || ALL_OPTION,
        channelId: selectedChannelId || ALL_OPTION,
        variationId: selectedVariationId || ALL_OPTION,
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
  const filters = payload.filters || {
    q: "",
    status: ALL_OPTION,
    channelId: ALL_OPTION,
    variationId: ALL_OPTION,
    onlyVisible: true,
  };
  const isLoading = navigation.state !== "idle";
  const [channelId, setChannelId] = useState(filters.channelId || ALL_OPTION);
  const [variationId, setVariationId] = useState(filters.variationId || ALL_OPTION);
  const [status, setStatus] = useState(filters.status || ALL_OPTION);
  const [onlyVisible, setOnlyVisible] = useState(Boolean(filters.onlyVisible));
  const statusFilterHref = (nextStatus: string) =>
    buildStatusFilterHref({
      q: filters.q,
      channelId: filters.channelId,
      variationId: filters.variationId,
      onlyVisible: filters.onlyVisible,
      status: nextStatus,
    });

  useEffect(() => {
    setChannelId(filters.channelId || ALL_OPTION);
    setVariationId(filters.variationId || ALL_OPTION);
    setStatus(filters.status || ALL_OPTION);
    setOnlyVisible(Boolean(filters.onlyVisible));
  }, [filters.channelId, filters.variationId, filters.status, filters.onlyVisible]);

  return (
    <div className="flex w-full flex-col gap-6 ">
      <Dialog>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Como funciona</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm leading-6 text-slate-600">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Regra de revisão
              </h2>
              <p>
                A tela compara o preço atual salvo para cada item, variação e canal com o
                preço sugerido calculado a partir do custo atual da ficha ativa. Se o preço
                sugerido ficar acima do preço atual, a linha entra em ajuste para cima. Se
                ficar abaixo, entra em ajuste para baixo.
              </p>
              <p>
                Diferenças de até {formatMoney(PRICE_TOLERANCE)} são tratadas como ok. Se a
                variação não tiver ficha ativa, a linha fica como sem ficha.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Preço sugerido
              </h2>
              <p>
                O preço sugerido usa o custo da ficha técnica ativa da variação, aplica o
                percentual de perda configurado, considera o DNA como percentual sobre o preço
                de venda e usa a margem-alvo do canal como lucro esperado.
              </p>
              <p>
                Em canais de marketplace, o cálculo também considera a taxa percentual do
                canal. O valor exibido na coluna preço recomendado é o preço mínimo com lucro
                retornado por esse cálculo.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Linhas visíveis
              </h2>
              <p>
                Com o filtro Só visíveis ligado, entram apenas itens ativos, vendáveis,
                visíveis no canal selecionado e que não estejam marcados como lançamento
                futuro.
              </p>
            </section>
          </div>
        </DialogContent>

      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Revisão de preços
            </h1>
            <DialogTrigger asChild>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
              >
                <CircleHelp className="h-4 w-4" />
                Como funciona
              </button>
            </DialogTrigger>
          </div>
          <p className="max-w-3xl text-sm text-slate-500">
            Mostra itens publicados no canal de venda usando apenas o modelo nativo de
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">Item*</code>.
            A margem é recalculada em tempo real com base na ficha ativa da variação.
          </p>
        </div>
      </div>
      </Dialog>

      <Separator />

      <Form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <input type="hidden" name="channelId" value={channelId} />
        <input type="hidden" name="variationId" value={variationId} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="onlyVisible" value={onlyVisible ? "true" : "false"} />

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
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todos os canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todos os canais</SelectItem>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Variação</span>
          <Select value={variationId} onValueChange={setVariationId}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todas as variações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todas as variações</SelectItem>
              {variations.map((variation) => (
                <SelectItem key={variation.id} value={variation.id}>
                  {variation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todos</SelectItem>
              <SelectItem value="raise-price">Ajustar para cima</SelectItem>
              <SelectItem value="lower-price">Ajustar para baixo</SelectItem>
              <SelectItem value="ok">Ok</SelectItem>
              <SelectItem value="missing-sheet">Sem ficha</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-2">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyVisible}
              onChange={(event) => setOnlyVisible(event.currentTarget.checked)}
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
        <MetricCard
          title="Linhas"
          value={String(summary?.total || 0)}
          to={statusFilterHref(ALL_OPTION)}
          active={!filters.status || filters.status === ALL_OPTION}
        />
        <MetricCard
          title="Subir preço"
          value={String(summary?.raisePrice || 0)}
          to={statusFilterHref("raise-price")}
          active={filters.status === "raise-price"}
        />
        <MetricCard
          title="Baixar preço"
          value={String(summary?.lowerPrice || 0)}
          to={statusFilterHref("lower-price")}
          active={filters.status === "lower-price"}
        />
        <MetricCard
          title="Ok"
          value={String(summary?.ok || 0)}
          to={statusFilterHref("ok")}
          active={filters.status === "ok"}
        />
        <MetricCard
          title="Sem ficha"
          value={String(summary?.missingSheet || 0)}
          to={statusFilterHref("missing-sheet")}
          active={filters.status === "missing-sheet"}
        />
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
              <TableHead className="text-right">Margem atual</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Preço recomendado</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-slate-500">
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
                  <TableCell className="text-right">{formatPercent(row.recalculatedProfitActualPerc)}</TableCell>
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

function buildStatusFilterHref(filters: {
  q: string;
  status: string;
  channelId: string;
  variationId: string;
  onlyVisible: boolean;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("channelId", filters.channelId || ALL_OPTION);
  params.set("variationId", filters.variationId || ALL_OPTION);
  params.set("status", filters.status || ALL_OPTION);
  params.set("onlyVisible", filters.onlyVisible ? "true" : "false");
  return `?${params.toString()}`;
}

function MetricCard({
  title,
  value,
  to,
  active,
}: {
  title: string;
  value: string;
  to: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={[
        "block rounded-lg border px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-transparent bg-white",
      ].join(" ")}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </Link>
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
    return <span>-</span>;
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

function StatusBadge({ status }: { status: SellingPriceReviewStatus }) {
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
