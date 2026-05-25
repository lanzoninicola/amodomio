import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
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
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { DnaHelpLink } from "~/components/admin/dna-help-link";

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

    const [
      channels,
      user,
      sizeMap,
      sellingPriceConfig,
      dnaHelpSetting,
      profitPriceHelpSetting,
    ] = await Promise.all([
      db.itemSellingChannel.findMany({ orderBy: [{ sortOrderIndex: "asc" }] }),
      authenticator.isAuthenticated(request),
      listSizeMapByKey(),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
      settingPrismaEntity.findByContextAndName("sell-price-management", "dnaHelpUrl"),
      settingPrismaEntity.findByContextAndName("sell-price-management", "profitPriceHelpUrl"),
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
        dnaHelpUrl: String(dnaHelpSetting?.value || "").trim() || null,
        profitPriceHelpUrl: String(profitPriceHelpSetting?.value || "").trim() || null,
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
      dnaHelpUrl: String(dnaHelpSetting?.value || "").trim() || null,
      profitPriceHelpUrl: String(profitPriceHelpSetting?.value || "").trim() || null,
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

type PriceManagementChannel = {
  id: string;
  key: string;
  name: string;
  targetMarginPerc: number;
  taxPerc: number;
  isMarketplace: boolean;
};

type PriceManagementRow = {
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
};

function buildChannelPriceExport({
  channels,
  rows,
  selectedChannelIds,
  filters,
}: {
  channels: PriceManagementChannel[];
  rows: PriceManagementRow[];
  selectedChannelIds: string[];
  filters: { search: string; variation: string | null };
}) {
  const selectedChannelIdSet = new Set(selectedChannelIds);
  const selectedChannels = channels.filter((channel) => selectedChannelIdSet.has(channel.id));
  const itemCount = rows.length;
  const variationCount = rows.reduce((total, row) => total + row.variations.length, 0);
  const generatedAt = new Date().toISOString();

  return {
    meta: {
      schema: "amodomio.sellPriceManagement.channelPrices.v1",
      generatedAt,
      sourceRoute: "/admin/vendas/sell-price-management/precos-por-canal",
      filters,
      selectedChannels: selectedChannels.map((channel) => ({
        id: channel.id,
        key: channel.key,
        name: channel.name,
        targetMarginPerc: channel.targetMarginPerc,
        taxPerc: channel.taxPerc,
        isMarketplace: channel.isMarketplace,
      })),
      itemCount,
      variationCount,
      currency: "BRL",
    },
    aiContext: {
      instructionsForAI:
        "Leia este node aiContext antes de analisar items. Ele descreve o contexto, regras de negocio e significado dos campos. Nao trate aiContext como registro exportado; os registros analisaveis estao em items.",
      datasetName: "Precos por canal de venda",
      language: "pt-BR",
      businessContext:
        "Export de precificacao de itens vendidos por canal no A Modo Mio. Cada item pode ter uma ou mais variacoes e cada variacao pode ter precos diferentes por canal de venda. O objetivo principal e analisar preco atual, custo, lucro, margem, taxa de canal e preco recomendado por canal.",
      routeContext:
        "Dados exportados da rota administrativa /admin/vendas/sell-price-management/precos-por-canal. A tela mostra todos os canais lado a lado e permite revisar/salvar precos por celula usando o fluxo nativo de ItemSellingPriceVariation.",
      selectedScope: {
        filters,
        selectedChannels: selectedChannels.map((channel) => ({
          id: channel.id,
          key: channel.key,
          name: channel.name,
        })),
        itemCount,
        variationCount,
        currency: "BRL",
      },
      analysisHints: [
        "Use items como a lista principal de registros exportados; aiContext e meta sao apenas contexto.",
        "Compare currentPriceAmount com recommendedPriceAmount para identificar precos abaixo ou acima do recomendado.",
        "Use profitPerc e profitAmount para avaliar margem real por variacao e canal.",
        "Quando linked for false, o item nao esta habilitado para aquele canal selecionado.",
        "Quando visible for false, o item esta vinculado ao canal, mas nao deve ser tratado como visivel/publicado naquele canal.",
        "Canais marketplace podem ter channelTaxPerc e channelTaxAmount relevantes no calculo do lucro.",
        "Se activeSheet for null, a variacao nao possui ficha tecnica ativa no export e o custo pode estar incompleto.",
      ],
      importantFields: {
        "items": "Lista principal de itens analisaveis.",
        "items[].id": "Identificador do item.",
        "items[].name": "Nome comercial do item.",
        "items[].canSell": "Indica se o item esta liberado para venda.",
        "items[].active": "Indica se o item esta ativo no cadastro.",
        "items[].upcoming": "Indica item futuro/proximo lancamento.",
        "items[].variations": "Variacoes/tamanhos/sabores vinculados ao item.",
        "items[].variations[].isReference": "Marca a variacao de referencia do item.",
        "items[].variations[].activeSheet": "Ficha tecnica ativa usada como fonte de custo.",
        "items[].variations[].channels": "Dados de preco, custo e lucro da variacao por canal selecionado.",
        "linked": "Indica se o item esta vinculado ao canal de venda.",
        "visible": "Indica se o item esta visivel/publicado naquele canal.",
        "currentPriceAmount": "Preco de venda atual salvo para a variacao no canal.",
        "previousPriceAmount": "Preco anterior salvo, quando disponivel.",
        "recommendedPriceAmount": "Preco recomendado calculado para atingir a margem alvo do canal.",
        "breakEvenPriceAmount": "Preco minimo estimado para empatar custos antes da margem alvo.",
        "baseCostAmount": "Custo base da ficha tecnica somado ao desperdicio considerado no calculo.",
        "dnaPerc": "Percentual de DNA/custo operacional usado no calculo.",
        "dnaAmount": "Valor monetario do DNA aplicado ao preco.",
        "channelTaxPerc": "Percentual de taxa do canal, relevante principalmente em marketplaces.",
        "channelTaxAmount": "Valor monetario da taxa do canal.",
        "operationalCostAmount": "Custo operacional total usado contra o preco de venda.",
        "profitAmount": "Lucro em reais calculado para o preco atual.",
        "profitPerc": "Margem de lucro percentual calculada para o preco atual.",
        "targetMarginPerc": "Margem alvo configurada para o canal.",
      },
    },
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      canSell: row.canSell,
      active: row.active,
      upcoming: row.upcoming,
      variations: row.variations.map((variation) => ({
        id: variation.id,
        name: variation.variationName,
        code: variation.variationCode,
        isReference: variation.isReference,
        activeSheet: variation.activeSheetId
          ? {
              id: variation.activeSheetId,
              name: variation.activeSheetName,
              updatedAt: variation.activeSheetUpdatedAt,
            }
          : null,
        channels: variation.channelData
          .filter((channelData) => selectedChannelIdSet.has(channelData.channelId))
          .map((channelData) => {
            const priceAmount = Number(channelData.currentRow?.priceAmount || 0);
            const profitSummary = calculateSellingPriceProfit({
              priceAmount,
              breakdown: channelData.computedBreakdown,
            });
            const recommendedPrice = Number(
              channelData.computedBreakdown.minimumPrice?.priceAmount?.withProfit || 0
            );
            const breakEvenPrice = Number(
              channelData.computedBreakdown.minimumPrice?.priceAmount?.breakEven || 0
            );
            const baseCostAmount =
              Number(channelData.computedBreakdown.custoFichaTecnica || 0) +
              Number(channelData.computedBreakdown.wasteCost || 0);

            return {
              id: channelData.channelId,
              key: channelData.channelKey,
              name: channelData.channelName,
              linked: channelData.channelLinked,
              visible: channelData.visibleForChannel,
              currentPriceAmount: priceAmount,
              previousPriceAmount: Number(channelData.currentRow?.previousPriceAmount || 0),
              recommendedPriceAmount: recommendedPrice,
              breakEvenPriceAmount: breakEvenPrice,
              baseCostAmount,
              dnaPerc: profitSummary.dnaPerc,
              dnaAmount: profitSummary.dnaAmount,
              channelTaxPerc: profitSummary.channelTaxPerc,
              channelTaxAmount: profitSummary.channelTaxAmount,
              operationalCostAmount: profitSummary.baseCostAmount + profitSummary.dnaAmount + profitSummary.channelTaxAmount,
              profitAmount: profitSummary.profitAmount,
              profitPerc: profitSummary.profitPerc,
              targetMarginPerc: Number(
                channelData.computedBreakdown.channel?.targetMarginPerc || 0
              ),
              updatedBy: channelData.currentRow?.updatedBy || null,
            };
          }),
      })),
    })),
  };
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ChannelPriceCell({
  itemId,
  itemVariationId,
  channelData,
  userEmail,
  isTargetChannel = false,
  dnaHelpUrl,
  profitPriceHelpUrl,
}: {
  itemId: string;
  itemVariationId: string;
  channelData: ChannelData;
  userEmail: string | null;
  isTargetChannel?: boolean;
  dnaHelpUrl?: string | null;
  profitPriceHelpUrl?: string | null;
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
    <td
      className={`border-r border-slate-100 px-2 py-2 align-top min-w-[210px] ${
        isTargetChannel
          ? "bg-sky-100"
          : lucroPerc < 0
            ? "bg-red-50"
            : lucroPerc <= 5
              ? "bg-orange-50"
              : ""
      }`}
    >
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
          <DnaHelpLink
            label={`PV com lucro ${targetMarginPerc}%`}
            url={profitPriceHelpUrl}
            className="text-slate-500"
          />
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
          <DnaHelpLink
            label={`DNA (${formatDecimalPlaces(dnaPerc)}%)`}
            url={dnaHelpUrl}
            className="text-slate-500"
          />
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
  const [searchParams] = useSearchParams();
  const targetItemId = searchParams.get("itemId");
  const targetVariationId = searchParams.get("variationId");
  const targetChannelId = searchParams.get("channelId");
  const [search, setSearch] = useState("");
  const [variationFilter, setVariationFilter] = useState<string | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [channelSelectionInitialized, setChannelSelectionInitialized] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  const payload = (loaderData?.payload || {}) as {
    channels?: PriceManagementChannel[];
    userEmail?: string | null;
    nativeModelAvailable?: boolean;
    dnaHelpUrl?: string | null;
    profitPriceHelpUrl?: string | null;
    rows?: PriceManagementRow[];
  };

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }
    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  useEffect(() => {
    if (!targetItemId || !targetVariationId) return;
    const row = document.getElementById(`price-row-${targetItemId}-${targetVariationId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [targetItemId, targetVariationId]);

  const channels = payload.channels || [];

  useEffect(() => {
    if (channelSelectionInitialized || channels.length === 0) return;
    setSelectedChannelIds(channels.map((channel) => channel.id));
    setChannelSelectionInitialized(true);
  }, [channelSelectionInitialized, channels]);

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

  const selectedChannelCount = selectedChannelIds.length;
  const exportData = useMemo(
    () =>
      buildChannelPriceExport({
        channels,
        rows: filteredRows,
        selectedChannelIds,
        filters: {
          search: search.trim(),
          variation: variationFilter,
        },
      }),
    [channels, filteredRows, search, selectedChannelIds, variationFilter]
  );

  const toggleSelectedChannel = (channelId: string, checked: boolean) => {
    setSelectedChannelIds((current) => {
      if (checked) return [...new Set([...current, channelId])];
      return current.filter((id) => id !== channelId);
    });
  };

  const handleExportJson = () => {
    if (selectedChannelIds.length === 0) {
      toast({
        title: "Selecione canal",
        description: "Marque pelo menos um canal para exportar o JSON.",
        variant: "destructive",
      });
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    downloadJsonFile(`precos-por-canal-${date}.json`, exportData);
    setExportDialogOpen(false);
  };

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Preços por canal — visão geral
          </h2>
          <p className="text-xs text-slate-500">
            Todos os canais lado a lado. Salve preços individualmente por célula.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="flex gap-2 sm:w-[24rem]">
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

          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 whitespace-nowrap"
                disabled={filteredRows.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar JSON
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar preços em JSON</DialogTitle>
                <DialogDescription>
                  Selecione os canais que serão incluídos no arquivo. A exportação usa os itens filtrados na tabela.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Selecione canal
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {channels.map((channel) => {
                    const checked = selectedChannelIds.includes(channel.id);
                    return (
                      <label
                        key={channel.id}
                        className="flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleSelectedChannel(channel.id, value === true)
                          }
                          aria-label={`Selecionar canal ${channel.name}`}
                        />
                        <span>{channel.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-500">
                  {filteredRows.length} itens no filtro atual · {selectedChannelCount} canais selecionados
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={handleExportJson}
                  disabled={selectedChannelCount === 0 || filteredRows.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar arquivo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                      id={`price-row-${row.id}-${variation.id}`}
                      className={[
                        "border-b border-slate-100 hover:bg-slate-50/50 scroll-mt-24",
                        targetItemId === row.id && targetVariationId === variation.id
                          ? "bg-sky-50 ring-1 ring-inset ring-sky-200"
                          : "",
                      ].join(" ")}
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
                          dnaHelpUrl={payload.dnaHelpUrl || null}
                          profitPriceHelpUrl={payload.profitPriceHelpUrl || null}
                          isTargetChannel={
                            targetItemId === row.id &&
                            targetVariationId === variation.id &&
                            targetChannelId === cd.channelId
                          }
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
