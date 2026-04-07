import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation, useOutletContext } from "@remix-run/react";
import { Eye, Pencil } from "lucide-react";
import { useEffect } from "react";
import { toast } from "~/components/ui/use-toast";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  buildNativeSellingPriceUpsertPayload,
  computeNativeItemSellingPriceBreakdown,
  listSizeMapByKey,
  pickLatestActiveSheet,
  resolveVariationSizeKey,
} from "~/domain/item/item-selling-price-calculation.server";
import { itemSellingPriceVariationEntity } from "~/domain/item/item-selling-price-variation.entity.server";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";
import type { AdminItemVendaOutletContext } from "./admin.items.$id.venda";

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

const pricesNavigation = [
  { name: "Visualizar", href: "visualizar", icon: Eye },
  { name: "Editar", href: "editar", icon: Pencil },
];

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const [
      item,
      editableVariations,
      nativeRows,
      nativeModelAvailable,
      itemChannelRows,
      activeSheets,
      sizeMap,
      sellingPriceConfig,
    ] = await Promise.all([
      db.item.findUnique({
        where: { id },
        select: { id: true, name: true },
      }),
      db.itemVariation.findMany({
        where: { itemId: id, deletedAt: null },
        select: {
          id: true,
          isReference: true,
            Variation: {
              select: {
                id: true,
                code: true,
                name: true,
                sortOrderIndex: true,
              },
            },
          },
        orderBy: [{ isReference: "desc" }, { createdAt: "asc" }],
      }),
      itemSellingPriceVariationEntity.findManyByItemId(id),
      itemSellingPriceVariationEntity.isAvailable(),
      db.itemSellingChannelItem.findMany({
        where: { itemId: id },
        select: {
          visible: true,
          ItemSellingChannel: true,
        },
      }),
      db.itemCostSheet.findMany({
        where: {
          itemId: id,
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
      listSizeMapByKey(),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
    ]);

    if (!item) return badRequest("Item não encontrado");

    const currentRowByKey = new Map(
      (nativeRows || []).map((row: any) => [
        `${row.itemVariationId}::${row.itemSellingChannelId}`,
        row,
      ])
    );
    const pricingRows = (itemChannelRows || []).flatMap((itemChannelRow: any) => {
      const channel = itemChannelRow.ItemSellingChannel;
      if (!channel?.id) return [];

      return (editableVariations || []).map((itemVariation: any) => {
        const activeSheet = pickLatestActiveSheet(
          (activeSheets || []).filter(
            (sheet: any) => String(sheet.itemVariationId || "") === String(itemVariation.id || "")
          )
        );
        const sizeKey = resolveVariationSizeKey({
          variationCode: itemVariation.Variation?.code,
          variationName: itemVariation.Variation?.name,
        });
        const size = sizeKey ? sizeMap.get(sizeKey) || null : null;
        const currentRow =
          currentRowByKey.get(`${itemVariation.id}::${channel.id}`) || null;
        const breakdown = computeNativeItemSellingPriceBreakdown({
          channel,
          itemCostAmount: Number(activeSheet?.costAmount || 0),
          sellingPriceConfig,
          size,
        });

        return {
          itemVariationId: itemVariation.id,
          itemSellingChannelId: channel.id,
          itemSellingChannelKey: String(channel.key || "").toLowerCase(),
          itemSellingChannelName: channel.name || String(channel.key || ""),
          variationName:
            itemVariation.Variation?.name ||
            (itemVariation.isReference ? "Referencia" : "Sem variação"),
          variationCode: itemVariation.Variation?.code || null,
          isReference: Boolean(itemVariation.isReference),
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
          activeSheetId: activeSheet?.id || null,
          activeSheetName: activeSheet?.name || null,
          activeSheetCostAmount: Number(activeSheet?.costAmount || 0),
          sizeKey,
          computedSellingPriceBreakdown: breakdown,
        };
      });
    });

    return ok({
      item,
      editableVariations: [...(editableVariations || [])].sort(
        (a: any, b: any) =>
          Number(Boolean(b?.isReference)) - Number(Boolean(a?.isReference)) ||
          Number(a?.Variation?.sortOrderIndex || 0) - Number(b?.Variation?.sortOrderIndex || 0) ||
          String(a?.Variation?.name || "").localeCompare(String(b?.Variation?.name || ""), "pt-BR")
      ),
      nativeRows,
      nativeModelAvailable,
      pricingRows,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");

    if (actionName !== "upsert-native-price") {
      return badRequest("Ação inválida");
    }

    const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();
    if (!nativeModelAvailable) {
      return badRequest("Modelo nativo de venda ainda não disponível no Prisma Client desta execução.");
    }

    const itemVariationId = String(formData.get("itemVariationId") || "").trim();
    const itemSellingChannelId = String(formData.get("itemSellingChannelId") || "").trim();
    const updatedBy = String(formData.get("updatedBy") || "").trim() || null;
    const published = String(formData.get("published") || "") === "on";
    const intent = String(formData.get("_intent") || "").trim();
    const priceAmount =
      intent === "apply-recommended"
        ? Number(formData.get("recommendedPriceAmount") || 0)
        : parseMoneyInput(formData.get("priceAmount"));

    if (!itemVariationId) return badRequest("Variação inválida");
    if (!itemSellingChannelId) return badRequest("Canal inválido");
    if (priceAmount == null) return badRequest("Preço inválido");

    const db = prismaClient as any;
    const itemChannel = await db.itemSellingChannelItem.findFirst({
      where: {
        itemId,
        itemSellingChannelId,
      },
      select: {
        id: true,
      },
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

export type AdminItemVendaPrecosOutletContext = AdminItemVendaOutletContext & {
  editableVariations: Array<{
    id: string;
    isReference: boolean;
    Variation?: {
      id: string;
      code: string;
      name: string;
    } | null;
  }>;
  nativeRows: Array<{
    id: string;
    itemVariationId: string;
    itemSellingChannelId: string;
    priceAmount: number;
    published: boolean;
    previousPriceAmount?: number;
    priceExpectedAmount?: number;
    profitActualPerc?: number;
    profitExpectedPerc?: number;
    updatedBy?: string | null;
  }>;
  nativeModelAvailable: boolean;
  pricingRows: Array<{
    itemVariationId: string;
    itemSellingChannelId: string;
    itemSellingChannelKey: string;
    itemSellingChannelName: string;
    variationName: string;
    variationCode: string | null;
    isReference: boolean;
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
    activeSheetId: string | null;
    activeSheetName: string | null;
    activeSheetCostAmount: number;
    sizeKey: string | null;
    computedSellingPriceBreakdown: ComputedSellingPriceBreakdown;
  }>;
};

export default function AdminItemVendaPrecosLayout() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const sellingContext = useOutletContext<AdminItemVendaOutletContext>();
  const location = useLocation();
  const activeSubtab = lastUrlSegment(location.pathname);
  const payload = (loaderData?.payload || {}) as {
    editableVariations?: AdminItemVendaPrecosOutletContext["editableVariations"];
    nativeRows?: AdminItemVendaPrecosOutletContext["nativeRows"];
    nativeModelAvailable?: boolean;
    pricingRows?: AdminItemVendaPrecosOutletContext["pricingRows"];
  };
  const basePath = `/admin/items/${sellingContext.item.id}/venda/precos`;

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  const outletContext: AdminItemVendaPrecosOutletContext = {
    ...sellingContext,
    editableVariations: payload.editableVariations || [],
    nativeRows: payload.nativeRows || [],
    nativeModelAvailable: payload.nativeModelAvailable ?? false,
    pricingRows: payload.pricingRows || [],
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-950">Preços</h2>
        <nav className="border-b border-slate-100">
          <div className="flex items-center gap-5 overflow-x-auto text-sm">
            {pricesNavigation.map((navItem) => {
              const Icon = navItem.icon;
              const isActive = activeSubtab === navItem.href;

              return (
                <Link
                  key={navItem.href}
                  to={`${basePath}/${navItem.href}`}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-2.5 font-medium transition ${
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon size={14} />
                  {navItem.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <Outlet context={outletContext} />
    </div>
  );
}
