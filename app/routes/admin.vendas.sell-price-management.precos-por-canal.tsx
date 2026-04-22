import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  buildNativeSellingPriceUpsertPayload,
  computeNativeItemSellingPriceBreakdown,
  listSizeMapByKey,
  pickLatestActiveSheet,
  resolveVariationSizeKey,
} from "~/domain/item/item-selling-price-calculation.server";
import { calculateSellingPriceProfit } from "~/domain/item/item-selling-price-review";
import { itemSellingPriceVariationEntity } from "~/domain/item/item-selling-price-variation.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";

export const meta: MetaFunction = () => [
  { title: "Vendas | Preços por canal" },
];

function parseMoneyInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();

    const [channels, user, sizeMap, sellingPriceConfig] = await Promise.all([
      db.itemSellingChannel.findMany({ orderBy: [{ sortOrderIndex: "asc" }] }),
      authenticator.isAuthenticated(request),
      listSizeMapByKey(),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
    ]);

    const channelIds = (channels || []).map((c: any) => String(c.id || ""));

    const allChannelLinks = await db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: { in: channelIds } },
      select: { itemId: true, itemSellingChannelId: true, visible: true },
    });

    const channelLinkMap = new Map<string, Map<string, boolean>>();
    for (const link of allChannelLinks || []) {
      const itemId = String(link.itemId || "");
      const chanId = String(link.itemSellingChannelId || "");
      if (!channelLinkMap.has(itemId)) channelLinkMap.set(itemId, new Map());
      channelLinkMap.get(itemId)!.set(chanId, Boolean(link.visible));
    }

    const itemIds = [...channelLinkMap.keys()];

    if (itemIds.length === 0) {
      return ok({
        channels: (channels || []).map((c: any) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          targetMarginPerc: Number(c.targetMarginPerc || 0),
          taxPerc: Number(c.taxPerc || 0),
          isMarketplace: Boolean(c.isMarketplace),
        })),
        userEmail: user ? user.email : null,
        nativeModelAvailable,
        rows: [],
      });
    }

    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        canSell: true,
        active: true,
        ItemSellingInfo: { select: { upcoming: true } },
        ItemVariation: {
          where: { deletedAt: null },
          select: {
            id: true,
            isReference: true,
            Variation: { select: { code: true, name: true, sortOrderIndex: true } },
          },
          orderBy: [{ createdAt: "asc" }],
        },
        ItemSellingPriceVariation: {
          where: { itemSellingChannelId: { in: channelIds } },
          select: {
            id: true,
            itemVariationId: true,
            itemSellingChannelId: true,
            priceAmount: true,
            previousPriceAmount: true,
            updatedBy: true,
          },
        },
        ItemCostSheet: {
          where: { isActive: true },
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
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const rows = (items || []).map((item: any) => {
      const priceByVarAndChannel = new Map<string, Map<string, any>>();
      for (const p of item.ItemSellingPriceVariation || []) {
        const varId = String(p.itemVariationId || "");
        const chanId = String(p.itemSellingChannelId || "");
        if (!priceByVarAndChannel.has(varId)) priceByVarAndChannel.set(varId, new Map());
        priceByVarAndChannel.get(varId)!.set(chanId, p);
      }

      const itemChannelLinks = channelLinkMap.get(String(item.id || "")) || new Map();

      const variations = [...(item.ItemVariation || [])]
        .sort(
          (a: any, b: any) =>
            Number(Boolean(b?.isReference)) - Number(Boolean(a?.isReference)) ||
            Number(a?.Variation?.sortOrderIndex || 0) -
              Number(b?.Variation?.sortOrderIndex || 0) ||
            String(a?.Variation?.name || "").localeCompare(
              String(b?.Variation?.name || ""),
              "pt-BR"
            )
        )
        .map((variation: any) => {
          const activeSheet = pickLatestActiveSheet(
            (item.ItemCostSheet || []).filter(
              (sheet: any) =>
                String(sheet.itemVariationId || "") === String(variation.id || "")
            )
          );
          const sizeKey = resolveVariationSizeKey({
            variationCode: variation.Variation?.code,
            variationName: variation.Variation?.name,
          });
          const size = sizeKey ? sizeMap.get(sizeKey) || null : null;
          const priceByChannel =
            priceByVarAndChannel.get(String(variation.id || "")) || new Map();

          const channelData = (channels || []).map((channel: any) => {
            const currentRow = priceByChannel.get(String(channel.id || "")) || null;
            const computedBreakdown = computeNativeItemSellingPriceBreakdown({
              channel,
              itemCostAmount: Number(activeSheet?.costAmount || 0),
              sellingPriceConfig,
              size,
            });
            return {
              channelId: channel.id,
              channelKey: channel.key,
              channelName: channel.name,
              channelLinked: itemChannelLinks.has(String(channel.id || "")),
              visibleForChannel: itemChannelLinks.get(String(channel.id || "")) === true,
              currentRow: currentRow
                ? {
                    priceAmount: Number(currentRow.priceAmount || 0),
                    previousPriceAmount: Number(currentRow.previousPriceAmount || 0),
                    updatedBy: currentRow.updatedBy || null,
                  }
                : null,
              computedBreakdown,
            };
          });

          return {
            id: variation.id,
            isReference: Boolean(variation.isReference),
            variationName: variation.Variation?.name || "Sem variação",
            variationCode: variation.Variation?.code || null,
            activeSheetId: activeSheet?.id || null,
            activeSheetName: activeSheet?.name || null,
            activeSheetUpdatedAt: activeSheet?.updatedAt ? new Date(activeSheet.updatedAt).toISOString() : null,
            channelData,
          };
        });

      return {
        id: item.id,
        name: item.name,
        canSell: Boolean(item.canSell),
        active: Boolean(item.active),
        upcoming: Boolean(item.ItemSellingInfo?.upcoming),
        variations,
      };
    });

    return ok({
      channels: (channels || []).map((c: any) => ({
        id: c.id,
        key: c.key,
        name: c.name,
        targetMarginPerc: Number(c.targetMarginPerc || 0),
        taxPerc: Number(c.taxPerc || 0),
        isMarketplace: Boolean(c.isMarketplace),
      })),
      userEmail: user ? user.email : null,
      nativeModelAvailable,
      rows,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");
    if (actionName !== "upsert-native-price") {
      return badRequest("Ação inválida");
    }

    const itemId = String(formData.get("itemId") || "").trim();
    const itemVariationId = String(formData.get("itemVariationId") || "").trim();
    const itemSellingChannelId = String(formData.get("itemSellingChannelId") || "").trim();
    const updatedBy = String(formData.get("updatedBy") || "").trim() || null;
    const priceAmount = parseMoneyInput(formData.get("priceAmount"));

    if (!itemId) return badRequest("Item inválido");
    if (!itemVariationId) return badRequest("Variação inválida");
    if (!itemSellingChannelId) return badRequest("Canal inválido");
    if (priceAmount == null) return badRequest("Preço inválido");

    const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();
    if (!nativeModelAvailable) {
      return badRequest("Modelo nativo de venda ainda não disponível nesta execução.");
    }

    const itemChannel = await db.itemSellingChannelItem.findFirst({
      where: { itemId, itemSellingChannelId },
      select: { id: true },
    });
    if (!itemChannel) {
      return badRequest("Este item não está habilitado para o canal selecionado.");
    }

    const { upsertInput } = await buildNativeSellingPriceUpsertPayload({
      db,
      itemId,
      itemVariationId,
      itemSellingChannelId,
      priceAmount,
      updatedBy,
    });

    await itemSellingPriceVariationEntity.upsert(upsertInput);

    return ok("Preço salvo.");
  } catch (error) {
    return serverError(error);
  }
}

type ChannelData = {
  channelId: string;
  channelKey: string;
  channelName: string;
  channelLinked: boolean;
  visibleForChannel: boolean;
  currentRow: {
    priceAmount: number;
    previousPriceAmount: number;
    updatedBy: string | null;
  } | null;
  computedBreakdown: ComputedSellingPriceBreakdown;
};

function ChannelPriceCell({
  itemId,
  itemVariationId,
  channelData,
  userEmail,
}: {
  itemId: string;
  itemVariationId: string;
  channelData: ChannelData;
  userEmail: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (!channelData.channelLinked) {
    return (
      <td className="border-r border-slate-100 px-2 py-2 text-center text-[10px] text-slate-300 align-middle">
        —
      </td>
    );
  }

  const priceAmount = Number(channelData.currentRow?.priceAmount || 0);
  const profitSummary = calculateSellingPriceProfit({
    priceAmount,
    breakdown: channelData.computedBreakdown,
  });
  const lucroValor = profitSummary.profitAmount;
  const lucroPerc = profitSummary.profitPerc;
  const targetMarginPerc = Number(channelData.computedBreakdown.channel?.targetMarginPerc || 0);
  const recommendedPrice = Number(
    channelData.computedBreakdown.minimumPrice?.priceAmount?.withProfit || 0
  );

  const dnaPerc = profitSummary.dnaPerc;
  const dnaValor = profitSummary.dnaAmount;
  const custoComDna = profitSummary.baseCostAmount + profitSummary.dnaAmount;
  const isMarketplace = Boolean(channelData.computedBreakdown.channel?.isMarketplace);
  const taxPerc = profitSummary.channelTaxPerc;
  const taxaCanal = profitSummary.channelTaxAmount;
  const previousPrice = Number(channelData.currentRow?.previousPriceAmount || 0);

  return (
    <td className={`border-r border-slate-100 px-2 py-2 align-top min-w-[210px] ${lucroPerc < 0 ? "bg-red-50" : lucroPerc <= 5 ? "bg-orange-50" : ""}`}>
      <Form method="post" className="space-y-2" ref={formRef}>
        <input type="hidden" name="_action" value="upsert-native-price" />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="itemVariationId" value={itemVariationId} />
        <input type="hidden" name="itemSellingChannelId" value={channelData.channelId} />
        <input
          type="hidden"
          name="updatedBy"
          value={userEmail || channelData.currentRow?.updatedBy || ""}
        />
        <input type="hidden" name="recommendedPriceAmount" value={recommendedPrice} />

        <div className="grid grid-cols-2 gap-2 items-start">
          <div className="flex flex-col justify-center">
            <span className="text-[9px] uppercase tracking-wide text-slate-400">PV anterior</span>
            <span className="font-mono text-xs text-slate-600">R$ {formatDecimalPlaces(previousPrice)}</span>
          </div>
          <div className="flex gap-1 items-center justify-end">
            <MoneyInput
              name="priceAmount"
              defaultValue={priceAmount}
              className="h-7 text-xs font-mono w-24"
            />
            <button
              type="submit"
              className="h-7 rounded border border-slate-200 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Salvar
            </button>
          </div>
        </div>

        <Separator />

        {lucroPerc < 0 ? (
          <div className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
            Lucro negativo: <span className="font-mono">{formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}</span>
          </div>
        ) : lucroPerc <= 5 ? (
          <div className="rounded-md bg-orange-500 px-2 py-1 text-[11px] font-semibold text-white">
            Lucro baixo: <span className="font-mono">{formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}</span>
          </div>
        ) : (
          <div className={`text-[11px] ${lucroPerc < targetMarginPerc ? "text-orange-400" : "text-slate-500"}`}>
            Lucro atual: <span className="font-mono">{formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}</span>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{`PV com lucro ${targetMarginPerc}%`}</span>
          <button
            type="submit"
            name="_intent"
            value="apply-recommended"
            className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900 transition hover:bg-slate-200"
          >
            R$ {formatDecimalPlaces(recommendedPrice)}
          </button>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-y-1 text-[11px]">
          <span className="text-slate-500">{`DNA (${formatDecimalPlaces(dnaPerc)}%)`}</span>
          <span className="text-right font-mono">R$ {formatDecimalPlaces(dnaValor)}</span>
          <span className="text-slate-500">Custo base + DNA</span>
          <span className="text-right font-mono">R$ {formatDecimalPlaces(custoComDna)}</span>
          {isMarketplace && (
            <>
              <span className="text-slate-500">{`Taxa canal (${formatDecimalPlaces(taxPerc)}%)`}</span>
              <span className="text-right font-mono">R$ {formatDecimalPlaces(taxaCanal)}</span>
            </>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-700">Custo operacional</span>
          <span className="font-mono font-semibold text-slate-900">R$ {formatDecimalPlaces(custoComDna + taxaCanal)}</span>
        </div>

      </Form>
    </td>
  );
}

export default function AdminGerenciamentoCardapioSellPriceManagementAllChannels() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [search, setSearch] = useState("");
  const [variationFilter, setVariationFilter] = useState<string | null>(null);

  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  const payload = (loaderData?.payload || {}) as {
    channels?: Array<{
      id: string;
      key: string;
      name: string;
      targetMarginPerc: number;
      taxPerc: number;
      isMarketplace: boolean;
    }>;
    userEmail?: string | null;
    nativeModelAvailable?: boolean;
    rows?: Array<{
      id: string;
      name: string;
      canSell: boolean;
      active: boolean;
      upcoming: boolean;
      variations: Array<{
        id: string;
        isReference: boolean;
        variationName: string;
        variationCode: string | null;
        activeSheetId: string | null;
        activeSheetName: string | null;
        activeSheetUpdatedAt: string | null;
        channelData: ChannelData[];
      }>;
    }>;
  };

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }
    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  const channels = payload.channels || [];

  const allVariationNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of payload.rows || []) {
      for (const v of row.variations) {
        if (v.variationName) names.add(v.variationName);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [payload.rows]);

  const filteredRows = useMemo(() => {
    const source = payload.rows || [];
    const q = search.trim().toLowerCase();
    return source
      .filter(
        (row) =>
          !q ||
          row.name.toLowerCase().includes(q) ||
          row.variations.some((v) => v.variationName.toLowerCase().includes(q))
      )
      .map((row) => ({
        ...row,
        variations: variationFilter
          ? row.variations.filter((v) => v.variationName === variationFilter)
          : row.variations,
      }))
      .filter((row) => row.variations.length > 0);
  }, [payload.rows, search, variationFilter]);

  if (hasLoaderError) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {loaderData?.message || "Falha ao carregar."}
      </div>
    );
  }

  if (payload.nativeModelAvailable === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Esta edição ainda não está disponível nesta execução.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Preços por canal — visão geral
          </h2>
          <p className="text-xs text-slate-500">
            Todos os canais lado a lado. Salve preços individualmente por célula.
          </p>
        </div>
        <div className="flex gap-2 w-full max-w-sm">
          <Select
            value={variationFilter ?? ""}
            onValueChange={(v) => setVariationFilter(v || null)}
          >
            <SelectTrigger className="w-36 bg-white">
              <SelectValue placeholder="Variação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {allVariationNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item ou variação"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          Nenhum item encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-r border-slate-200 whitespace-nowrap">
                  Variação
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-r border-slate-200 whitespace-nowrap">
                  Custo base
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-r border-slate-200 whitespace-nowrap">
                  Break-even
                </th>
                {channels.map((channel) => (
                  <th
                    key={channel.id}
                    className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-700 border-r border-slate-200 whitespace-nowrap min-w-[200px]"
                  >
                    {channel.name}
                    {channel.isMarketplace ? (
                      <span className="ml-1 text-[9px] font-normal text-slate-400 normal-case">
                        taxa {formatDecimalPlaces(channel.taxPerc)}%
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <td
                      colSpan={3 + channels.length}
                      className="px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/items/${row.id}`}
                          className="text-xs font-semibold text-slate-900 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.name}
                        </Link>
                        {!row.canSell && (
                          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                            Venda off
                          </span>
                        )}
                        {row.upcoming && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                            Futuro
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {row.variations.map((variation) => {
                  const custoBase =
                    Number(variation.channelData[0]?.computedBreakdown.custoFichaTecnica || 0) +
                    Number(variation.channelData[0]?.computedBreakdown.wasteCost || 0);
                  const breakEven = Number(
                    variation.channelData[0]?.computedBreakdown.minimumPrice?.priceAmount
                      ?.breakEven || 0
                  );

                  return (
                    <tr
                      key={variation.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50"
                    >

                      <td className="px-3 py-2 align-top border-r border-slate-200 text-xs text-slate-700 whitespace-nowrap">
                        {variation.isReference
                          ? `${variation.variationName} · ref`
                          : variation.variationName}
                        {variation.activeSheetId ? (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            <Link
                              to={`/admin/item-cost-sheets/${variation.activeSheetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline hover:text-slate-600"
                            >
                              {variation.activeSheetName}
                            </Link>
                            {variation.activeSheetUpdatedAt && (() => {
                              const days = Math.floor((Date.now() - new Date(variation.activeSheetUpdatedAt).getTime()) / 86_400_000);
                              const date = new Date(variation.activeSheetUpdatedAt).toLocaleDateString("pt-BR");
                              return (
                                <div className="text-[9px] text-slate-400">
                                  {date} · {days === 0 ? "hoje" : `${days}d atrás`}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-500">Sem ficha</div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right border-r border-slate-200 text-xs font-mono text-slate-700 align-top whitespace-nowrap">
                        R$ {formatDecimalPlaces(custoBase)}
                      </td>

                      <td className="px-3 py-2 text-right border-r border-slate-200 text-xs font-mono text-slate-700 align-top whitespace-nowrap">
                        R$ {formatDecimalPlaces(breakEven)}
                      </td>

                      {variation.channelData.map((cd) => (
                        <ChannelPriceCell
                          key={cd.channelId}
                          itemId={row.id}
                          itemVariationId={variation.id}
                          channelData={cd}
                          userEmail={payload.userEmail || null}
                        />
                      ))}
                    </tr>
                  );
                })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
