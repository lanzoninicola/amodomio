import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { NativeItemSellingPriceCard } from "~/components/admin/native-item-selling-price-card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
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
import { itemSellingPriceVariationEntity } from "~/domain/item/item-selling-price-variation.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function parseMoneyInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const sellingChannelKey = String(params.channel || "").trim();
    if (!sellingChannelKey) return badRequest("Canal inválido");

    const db = prismaClient as any;
    if (typeof db.itemSellingChannel?.findFirst !== "function") {
      return badRequest("Modelo ItemSellingChannel não disponível no Prisma Client desta execução.");
    }
    if (typeof db.itemSellingChannelItem?.findMany !== "function") {
      return badRequest("Modelo ItemSellingChannelItem não disponível no Prisma Client desta execução.");
    }
    if (typeof db.item?.findMany !== "function") {
      return badRequest("Modelo Item não disponível no Prisma Client desta execução.");
    }

    const [channel, user, nativeModelAvailable, sizeMap, sellingPriceConfig] = await Promise.all([
      db.itemSellingChannel.findFirst({
        where: { key: sellingChannelKey },
      }),
      authenticator.isAuthenticated(request),
      itemSellingPriceVariationEntity.isAvailable(),
      listSizeMapByKey(),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
    ]);

    if (!channel?.id) return badRequest("Canal não encontrado");

    const channelLinks = await db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: channel.id },
      select: {
        itemId: true,
        visible: true,
        itemSellingChannelId: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const itemIds = Array.from(
      new Set(
        (channelLinks || [])
          .map((row: any) => String(row.itemId || "").trim())
          .filter(Boolean)
      )
    );

    if (itemIds.length === 0) {
      return ok({
        channel: {
          id: channel.id,
          key: channel.key,
          name: channel.name,
        },
        userEmail: user?.email || null,
        nativeModelAvailable,
        rows: [],
      });
    }

    const items = await db.item.findMany({
      where: {
        id: { in: itemIds },
      },
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
        ItemVariation: {
          where: { deletedAt: null },
          select: {
            id: true,
            isReference: true,
            Variation: {
              select: {
                code: true,
                name: true,
                sortOrderIndex: true,
              },
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
        ItemSellingPriceVariation: {
          where: {
            itemSellingChannelId: channel.id,
          },
          select: {
            id: true,
            itemVariationId: true,
            itemSellingChannelId: true,
            priceAmount: true,
            previousPriceAmount: true,
            priceExpectedAmount: true,
            profitActualPerc: true,
            profitExpectedPerc: true,
            published: true,
            updatedBy: true,
          },
        },
        ItemCostSheet: {
          where: {
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
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const channelLinkByItemId = new Map(
      (channelLinks || []).map((row: any) => [String(row.itemId || ""), row])
    );

    const rows = (items || []).map((item: any) => {
      const channelLink = channelLinkByItemId.get(String(item.id || "")) || null;
      const currentRowByVariationId = new Map(
        (item.ItemSellingPriceVariation || []).map((row: any) => [String(row.itemVariationId || ""), row])
      );

      return {
        id: item.id,
        name: item.name,
        canSell: Boolean(item.canSell),
        active: Boolean(item.active),
        upcoming: Boolean(item.ItemSellingInfo?.upcoming),
        visibleForChannel: channelLink?.visible === true,
        variations: [...(item.ItemVariation || [])]
          .sort(
            (a: any, b: any) =>
              Number(Boolean(b?.isReference)) - Number(Boolean(a?.isReference)) ||
              Number(a?.Variation?.sortOrderIndex || 0) - Number(b?.Variation?.sortOrderIndex || 0) ||
              String(a?.Variation?.name || "").localeCompare(String(b?.Variation?.name || ""), "pt-BR")
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
          const currentRow = currentRowByVariationId.get(String(variation.id || "")) || null;

          return {
            id: variation.id,
            isReference: Boolean(variation.isReference),
            variationName: variation.Variation?.name || "Sem variação",
            variationCode: variation.Variation?.code || null,
            activeSheetId: activeSheet?.id || null,
            activeSheetName: activeSheet?.name || null,
            currentRow: currentRow
              ? {
                id: currentRow.id,
                priceAmount: Number(currentRow.priceAmount || 0),
                previousPriceAmount: Number(currentRow.previousPriceAmount || 0),
                priceExpectedAmount: Number(currentRow.priceExpectedAmount || 0),
                profitActualPerc: Number(currentRow.profitActualPerc || 0),
                profitExpectedPerc: Number(currentRow.profitExpectedPerc || 0),
                published: Boolean(currentRow.published),
                updatedBy: currentRow.updatedBy || null,
              }
              : null,
            computedSellingPriceBreakdown: computeNativeItemSellingPriceBreakdown({
              channel,
              itemCostAmount: Number(activeSheet?.costAmount || 0),
              sellingPriceConfig,
              size,
            }),
          };
        }),
      };
    });

    return ok({
      channel: {
        id: channel.id,
        key: channel.key,
        name: channel.name,
      },
      userEmail: user?.email || null,
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
    const published = String(formData.get("published") || "") === "on";
    const intent = String(formData.get("_intent") || "").trim();
    const priceAmount =
      intent === "apply-recommended"
        ? Number(formData.get("recommendedPriceAmount") || 0)
        : parseMoneyInput(formData.get("priceAmount"));

    if (!itemId) return badRequest("Item inválido");
    if (!itemVariationId) return badRequest("Variação inválida");
    if (!itemSellingChannelId) return badRequest("Canal inválido");
    if (priceAmount == null) return badRequest("Preço inválido");

    const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();
    if (!nativeModelAvailable) {
      return badRequest("Modelo nativo de venda ainda não disponível nesta execução.");
    }

    const itemChannel = await db.itemSellingChannelItem.findFirst({
      where: {
        itemId,
        itemSellingChannelId,
      },
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
      published,
      updatedBy,
    });

    await itemSellingPriceVariationEntity.upsert(upsertInput);

    return ok("Preço nativo do item salvo.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminGerenciamentoCardapioSellPriceManagementItemsEdit() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  const payload = (loaderData?.payload || {}) as {
    channel?: { id: string; key: string; name: string };
    userEmail?: string | null;
    nativeModelAvailable?: boolean;
    rows?: Array<{
      id: string;
      name: string;
      canSell: boolean;
      active: boolean;
      upcoming: boolean;
      visibleForChannel: boolean;
      variations: Array<{
        id: string;
        isReference: boolean;
        variationName: string;
        variationCode: string | null;
        activeSheetId: string | null;
        activeSheetName: string | null;
        currentRow: {
          id: string;
          priceAmount: number;
          previousPriceAmount: number;
          priceExpectedAmount: number;
          profitActualPerc: number;
          profitExpectedPerc: number;
          published: boolean;
          updatedBy: string | null;
        } | null;
        computedSellingPriceBreakdown: any;
      }>;
    }>;
  };
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  const filteredRows = useMemo(() => {
    const source = payload.rows || [];
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return source;

    return source.filter((row) => {
      if (row.name.toLowerCase().includes(normalizedSearch)) return true;
      return row.variations.some((variation) =>
        variation.variationName.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [payload.rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Editar preços nativos por canal
          </h2>
          <div className="text-sm text-slate-500">
            Canal: {payload.channel?.name || payload.channel?.key || "-"}.
            Source: Item. Embalagem saiu do cálculo separado.
          </div>
        </div>
        <div className="w-full max-w-sm">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar item ou variação"
          />
        </div>
      </div>

      {hasLoaderError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loaderData?.message || "Falha ao carregar a tela."}
        </div>
      ) : payload.nativeModelAvailable === false ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta edição ainda não está disponível nesta execução.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          Nenhum item encontrado para este canal.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row, index) => (
            <section key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{row.name}</h3>
                  <div className="text-xs text-slate-500">{row.id}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span
                    className={`rounded-full px-2 py-1 ${row.canSell ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                  >
                    {row.canSell ? "Pode vender" : "Venda off"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${row.visibleForChannel ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}
                  >
                    {row.visibleForChannel ? "Canal visível" : "Canal oculto"}
                  </span>
                  {row.upcoming ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                      Lançamento futuro
                    </span>
                  ) : null}
                </div>
              </div>

              <div
                className="mt-4 grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(4, row.variations.length)}, minmax(320px, 1fr))`,
                }}
              >
                {row.variations.map((variation) => (
                  <NativeItemSellingPriceCard
                    key={variation.id}
                    itemId={row.id}
                    itemVariationId={variation.id}
                    itemSellingChannelId={payload.channel?.id || ""}
                    variationLabel={
                      variation.isReference
                        ? `${variation.variationName} · referência`
                        : variation.variationName
                    }
                    channelLabel={payload.channel?.name || null}
                    currentRow={variation.currentRow}
                    computedSellingPriceBreakdown={variation.computedSellingPriceBreakdown}
                    activeSheetId={variation.activeSheetId}
                    activeSheetName={variation.activeSheetName}
                    updatedBy={payload.userEmail || null}
                  />
                ))}
              </div>

              {index < filteredRows.length - 1 ? <Separator className="mt-4" /> : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
