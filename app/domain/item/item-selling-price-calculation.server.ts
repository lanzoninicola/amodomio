import type { ItemSellingChannel, MenuItemSize } from "@prisma/client";
import {
  type ComputedSellingPriceBreakdown,
  menuItemSellingPriceUtilityEntity,
} from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { normalizeVariationToSizeKey } from "~/domain/costs/menu-item-cost-sync.server";

type SellingPriceConfig = Awaited<
  ReturnType<typeof menuItemSellingPriceUtilityEntity.getSellingPriceConfig>
>;

export type ActiveItemCostSheetSummary = {
  id: string;
  name: string;
  itemId: string;
  itemVariationId: string;
  costAmount: number;
  updatedAt: Date | null;
  activatedAt: Date | null;
};

export function computeNativeItemSellingPriceBreakdown(params: {
  channel: ItemSellingChannel;
  itemCostAmount: number;
  sellingPriceConfig: SellingPriceConfig;
  size: MenuItemSize | null;
}): ComputedSellingPriceBreakdown {
  const custoFichaTecnica = Number(params.itemCostAmount || 0);
  const wasteFactor = 1 + Number(params.sellingPriceConfig.wastePercentage || 0) / 100;
  const doughCostAmount = Number(params.size?.pizzaDoughCostAmount || 0);
  const packagingCostAmount = 0;
  const itemTotalCost = custoFichaTecnica * wasteFactor + doughCostAmount + packagingCostAmount;
  const targetProfitPerc = Number(params.channel?.targetMarginPerc || 0);

  let price = menuItemSellingPriceUtilityEntity.calculateSellingPrice(
    itemTotalCost,
    Number(params.sellingPriceConfig.dnaPercentage || 0),
    targetProfitPerc
  );

  if (params.channel?.isMarketplace) {
    price = menuItemSellingPriceUtilityEntity.calculateSellingPriceForMarketplace(
      price.priceAmount,
      0,
      Number(params.channel.taxPerc || 0)
    );
  }

  return {
    custoFichaTecnica: Number(custoFichaTecnica.toFixed(2)),
    wasteCost: Number((custoFichaTecnica * (wasteFactor - 1)).toFixed(2)),
    doughCostAmount: Number(doughCostAmount.toFixed(2)),
    packagingCostAmount: 0,
    dnaPercentage: Number(params.sellingPriceConfig.dnaPercentage || 0),
    channel: {
      name: params.channel?.name || "",
      taxPerc: Number(params.channel?.taxPerc || 0),
      feeAmount: Number(params.channel?.feeAmount || 0),
      isMarketplace: Boolean(params.channel?.isMarketplace),
      onlinePaymentTaxPerc: Number(params.channel?.onlinePaymentTaxPerc || 0),
      targetMarginPerc: targetProfitPerc,
    },
    minimumPrice: {
      priceAmount: {
        withProfit: Number(price.priceAmount.withProfit || 0),
        breakEven: Number(price.priceAmount.breakEven || 0),
      },
      formulaExpression: price.formulaExpression,
      formulaExplanation: price.formulaExplanation,
    },
  };
}

export async function listSizeMapByKey() {
  const sizes = await menuItemSizePrismaEntity.findAll();
  return new Map(
    (sizes || []).map((size: any) => [String(size.key || "").trim().toLowerCase(), size as MenuItemSize])
  );
}

export function resolveVariationSizeKey(params: {
  variationCode?: string | null;
  variationName?: string | null;
}) {
  return (
    normalizeVariationToSizeKey(params.variationCode) ||
    normalizeVariationToSizeKey(params.variationName) ||
    null
  );
}

export function pickLatestActiveSheet<T extends ActiveItemCostSheetSummary>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aDate = new Date(a.activatedAt || a.updatedAt || 0).getTime();
    const bDate = new Date(b.activatedAt || b.updatedAt || 0).getTime();
    return bDate - aDate;
  })[0] || null;
}

export async function buildNativeSellingPriceUpsertPayload(params: {
  db: any;
  itemId: string;
  itemVariationId: string;
  itemSellingChannelId: string;
  priceAmount: number;
  published: boolean;
  updatedBy?: string | null;
}) {
  const [variation, channel, activeSheets, sellingPriceConfig, sizeMap] = await Promise.all([
    params.db.itemVariation.findUnique({
      where: { id: params.itemVariationId },
      select: {
        id: true,
        itemId: true,
        Variation: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
    params.db.itemSellingChannel.findUnique({
      where: { id: params.itemSellingChannelId },
    }),
    params.db.itemCostSheet.findMany({
      where: {
        itemId: params.itemId,
        itemVariationId: params.itemVariationId,
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
    menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
    listSizeMapByKey(),
  ]);

  if (!variation?.id) {
    throw new Error("Variação do item não encontrada");
  }

  if (String(variation.itemId || "") !== String(params.itemId || "")) {
    throw new Error("Variação não pertence ao item informado");
  }

  if (!channel?.id) {
    throw new Error("Canal não encontrado");
  }

  const activeSheet = pickLatestActiveSheet(activeSheets);
  const sizeKey = resolveVariationSizeKey({
    variationCode: variation.Variation?.code,
    variationName: variation.Variation?.name,
  });
  const size = sizeKey ? sizeMap.get(sizeKey) || null : null;
  const computedSellingPriceBreakdown = computeNativeItemSellingPriceBreakdown({
    channel,
    itemCostAmount: Number(activeSheet?.costAmount || 0),
    sellingPriceConfig,
    size,
  });

  const profitActualPerc =
    menuItemSellingPriceUtilityEntity.calculateProfitPercFromSellingPrice(
      Number(params.priceAmount || 0),
      {
        fichaTecnicaCostAmount: computedSellingPriceBreakdown.custoFichaTecnica,
        packagingCostAmount: 0,
        doughCostAmount: computedSellingPriceBreakdown.doughCostAmount,
        wasteCostAmount: computedSellingPriceBreakdown.wasteCost,
      },
      computedSellingPriceBreakdown.dnaPercentage ?? 0
    );

  return {
    activeSheet,
    sizeKey,
    computedSellingPriceBreakdown,
    upsertInput: {
      itemId: params.itemId,
      itemVariationId: params.itemVariationId,
      itemSellingChannelId: params.itemSellingChannelId,
      priceAmount: Number(params.priceAmount || 0),
      published: Boolean(params.published),
      updatedBy: params.updatedBy || null,
      priceExpectedAmount:
        computedSellingPriceBreakdown.minimumPrice.priceAmount.withProfit,
      profitActualPerc,
      profitExpectedPerc:
        computedSellingPriceBreakdown.channel.targetMarginPerc,
      discountPercentage: 0,
    },
  };
}
