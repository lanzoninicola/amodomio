import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { ok, serverError } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  computeNativeItemSellingPriceBreakdown,
  listSizeMapByKey,
  pickLatestActiveSheet,
  resolveVariationSizeKey,
} from "~/domain/item/item-selling-price-calculation.server";
import {
  calculateSellingPriceProfit,
  getSellingPriceMarginBand,
  type SellingPriceMarginBand,
} from "~/domain/item/item-selling-price-review";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type MarginBand = SellingPriceMarginBand;

export const meta: MetaFunction = () => [
  { title: "Vendas | Faixas de lucro" },
];

const BAND_CONFIG: Record<
  MarginBand,
  { label: string; status: string; bg: string; text: string; border: string }
> = {
  negative: {
    label: "< 0%",
    status: "Crítico",
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  "0-5": {
    label: "0–5%",
    status: "Baixo",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
  },
  "5-10": {
    label: "5–10%",
    status: "Médio",
    bg: "bg-yellow-100",
    text: "text-yellow-900",
    border: "border-yellow-200",
  },
  "10-15": {
    label: "10–15%",
    status: "Bom",
    bg: "bg-lime-100",
    text: "text-emerald-950",
    border: "border-lime-200",
  },
  "above-15": {
    label: "> 15%",
    status: "Excelente",
    bg: "bg-emerald-900",
    text: "text-white",
    border: "border-emerald-900",
  },
  "no-data": {
    label: "–",
    status: "Sem dados",
    bg: "bg-slate-50",
    text: "text-slate-400",
    border: "border-slate-100",
  },
};

type Channel = { id: string; key: string; name: string };

type ItemRow = {
  itemId: string;
  name: string;
  channels: Record<string, { perc: number | null; band: MarginBand }>;
};

const ALL_VARIATIONS_VALUE = "__all__";
const DEFAULT_MEDIUM_VARIATION_CODES = new Set([
  "pizza-medium",
  "medio",
  "media",
  "pizza-medio",
  "pizza-media",
]);

function resolveDefaultVariationCode(
  variations: Array<{ code: string | null; name: string | null }>
) {
  const defaultByCode = variations.find((variation) =>
    DEFAULT_MEDIUM_VARIATION_CODES.has(
      String(variation.code || "").trim().toLowerCase()
    )
  );
  if (defaultByCode?.code) return defaultByCode.code;

  const defaultByName = variations.find((variation) => {
    const name = String(variation.name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return name.includes("medio") || name.includes("media") || name.includes("medium");
  });

  return defaultByName?.code || ALL_VARIATIONS_VALUE;
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const requestedVariationCode = String(url.searchParams.get("variation") || "").trim();
    const itemQuery = String(url.searchParams.get("item") || "").trim();

    const [channels, variations, visibleChannelLinks, priceRows, sellingPriceConfig, sizeMap] = await Promise.all([
      db.itemSellingChannel.findMany({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
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
      }),
      db.variation.findMany({
        where: { kind: "size", deletedAt: null },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      db.itemSellingChannelItem.findMany({
        where: { visible: true },
        select: { itemId: true, itemSellingChannelId: true },
      }),
      db.itemSellingPriceVariation.findMany({
        select: {
          itemId: true,
          itemVariationId: true,
          itemSellingChannelId: true,
          priceAmount: true,
          Item: { select: { name: true, active: true } },
          ItemVariation: {
            select: {
              id: true,
              Variation: { select: { code: true, name: true } },
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
      }),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
      listSizeMapByKey(),
    ]);

    const visibleLinkSet = new Set(
      (visibleChannelLinks || []).map(
        (link: any) => `${String(link.itemId || "")}:${String(link.itemSellingChannelId || "")}`
      )
    );

    const variationCode =
      requestedVariationCode || resolveDefaultVariationCode(variations || []);

    let rows = (priceRows || []).filter(
      (r: any) =>
        r.Item?.active &&
        visibleLinkSet.has(
          `${String(r.itemId || "")}:${String(r.itemSellingChannelId || "")}`
        )
    );

    if (variationCode && variationCode !== ALL_VARIATIONS_VALUE) {
      rows = rows.filter(
        (r: any) => r.ItemVariation?.Variation?.code === variationCode
      );
    }

    if (itemQuery) {
      const normalizedItemQuery = normalizeSearchText(itemQuery);
      rows = rows.filter((r: any) =>
        normalizeSearchText(r.Item?.name).includes(normalizedItemQuery)
      );
    }

    const itemIds = Array.from(new Set(rows.map((row: any) => String(row.itemId || "")).filter(Boolean)));
    const activeSheets = itemIds.length
      ? await db.itemCostSheet.findMany({
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
      : [];

    const activeSheetsByVariation = new Map<string, any[]>();
    for (const sheet of activeSheets || []) {
      const key = `${String(sheet.itemId || "")}:${String(sheet.itemVariationId || "")}`;
      const current = activeSheetsByVariation.get(key) || [];
      current.push(sheet);
      activeSheetsByVariation.set(key, current);
    }

    // pivot: item × channel → min (worst) margin
    const pivotMap = new Map<string, Map<string, number | null>>();
    const itemNames = new Map<string, string>();

    for (const row of rows) {
      const itemId = String(row.itemId || "");
      const itemVariationId = String(row.itemVariationId || row.ItemVariation?.id || "");
      const channelId = String(row.itemSellingChannelId || "");
      const activeSheet = pickLatestActiveSheet(
        activeSheetsByVariation.get(`${itemId}:${itemVariationId}`) || []
      );
      const sizeKey = resolveVariationSizeKey({
        variationCode: row.ItemVariation?.Variation?.code,
        variationName: row.ItemVariation?.Variation?.name,
      });
      const size = sizeKey ? sizeMap.get(sizeKey) || null : null;
      const breakdown = activeSheet
        ? computeNativeItemSellingPriceBreakdown({
          channel: row.ItemSellingChannel,
          itemCostAmount: Number(activeSheet.costAmount || 0),
          sellingPriceConfig,
          size,
        })
        : null;
      const perc = breakdown
        ? calculateSellingPriceProfit({
          priceAmount: Number(row.priceAmount || 0),
          breakdown,
        }).profitPerc
        : null;

      itemNames.set(itemId, row.Item?.name || itemId);
      if (!pivotMap.has(itemId)) pivotMap.set(itemId, new Map());

      const chMap = pivotMap.get(itemId)!;
      const existing = chMap.get(channelId);
      if (existing === undefined) {
        chMap.set(channelId, perc);
      } else if (perc !== null && (existing === null || perc < existing)) {
        chMap.set(channelId, perc);
      }
    }

    const items: ItemRow[] = Array.from(pivotMap.entries())
      .map(([itemId, chMap]) => ({
        itemId,
        name: itemNames.get(itemId) || itemId,
        channels: Object.fromEntries(
          Array.from(chMap.entries()).map(([chId, perc]) => [
            chId,
            { perc, band: getSellingPriceMarginBand(perc) },
          ])
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return ok({
      channels,
      variations,
      items,
      filters: {
        variation: variationCode || ALL_VARIATIONS_VALUE,
        item: itemQuery,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasFaixasLucroPage() {
  const data = useLoaderData<typeof loader>();
  const payload = (data?.payload || {}) as {
    channels: Channel[];
    variations: Array<{ id: string; code: string; name: string }>;
    items: ItemRow[];
    filters: { variation: string; item: string };
  };
  const navigation = useNavigation();
  const { channels = [], variations = [], items = [], filters } = payload;
  const isLoading = navigation.state !== "idle";
  const [variation, setVariation] = useState(filters?.variation || ALL_VARIATIONS_VALUE);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Faixas de lucro por sabor
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Menor margem publicada de cada sabor em todos os canais de venda.
          Clique em uma célula para editar os preços do canal.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-slate-500">Faixas:</span>
        {(Object.entries(BAND_CONFIG) as [MarginBand, typeof BAND_CONFIG[MarginBand]][]).map(
          ([key, cfg]) => (
            <span
              key={key}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-semibold uppercase",
                cfg.bg, cfg.text, cfg.border
              )}
            >
              {cfg.label} · {cfg.status}
            </span>
          )
        )}
      </div>

      {/* Filter */}
      <Form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="variation" value={variation} />
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Tamanho</span>
          <Select value={variation} onValueChange={setVariation}>
            <SelectTrigger className="h-9 w-48 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todos os tamanhos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VARIATIONS_VALUE}>Todos os tamanhos</SelectItem>
              {variations.map((v) => (
                <SelectItem key={v.id} value={v.code}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Item</span>
          <input
            type="search"
            name="item"
            defaultValue={filters?.item || ""}
            placeholder="Procurar item"
            className="h-9 w-72 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
          />
        </label>
        <button
          type="submit"
          className="h-9 inline-flex items-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white"
        >
          {isLoading ? "..." : "Filtrar"}
        </button>
      </Form>

      {/* Matrix */}
      <div className="overflow-x-auto ">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              <th className="sticky left-0 z-20 min-w-[250px] bg-white px-5 py-5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Item
              </th>
              {channels.map((ch) => (
                <th
                  key={ch.id}
                  className="min-w-[180px] px-4 py-5 text-center align-middle"
                >
                  <span className="block text-base font-semibold leading-tight text-slate-900">
                    {ch.name}
                  </span>
                  <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Canal de venda
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={channels.length + 1}
                  className="py-16 text-center text-slate-400 text-sm"
                >
                  Nenhum item publicado encontrado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.itemId}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="sticky left-0 z-10 bg-white px-5 py-3.5">
                    <span className="text-sm font-semibold leading-tight text-slate-800">
                      {item.name}
                    </span>
                  </td>
                  {channels.map((ch) => {
                    const entry = item.channels[ch.id];
                    const band = entry?.band ?? "no-data";
                    const perc = entry?.perc ?? null;
                    const cfg = BAND_CONFIG[band];
                    return (
                      <td key={ch.id} className="px-4 py-3.5 text-center align-middle">
                        <Link
                          to={`/admin/gerenciamento/cardapio/sell-price-management/${ch.key}/edit-items`}
                          title={`Editar preços — ${ch.name}`}
                          className={cn(
                            "mx-auto flex h-14 w-full max-w-[150px] flex-col items-center justify-center rounded-md border",
                            "shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                            cfg.bg, cfg.text, cfg.border
                          )}
                        >
                          <span className="font-mono text-xl font-semibold leading-none tracking-normal">
                            {perc !== null ? `${Number(perc).toFixed(1)}%` : "–"}
                          </span>
                          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                            {cfg.status}
                          </span>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {items.length} sabores · {channels.length} canais
      </p>
    </div>
  );
}
