import prismaClient from "~/lib/prisma/client.server";
import { itemSellingPriceVariationEntity } from "./item-selling-price-variation.entity.server";
import { itemVariationPrismaEntity } from "./item-variation.prisma.entity.server";
import { variationPrismaEntity } from "./variation.prisma.entity.server";

type BackfillStats = {
  scannedLegacyRows: number;
  migratedRows: number;
  skippedRows: number;
  channelLinksSynced: number;
  duplicateGroups: number;
  duplicatesSkipped: number;
  createdSizeVariations: number;
  linkedItemVariations: number;
  usedBaseVariationFallback: number;
  missingItemLinks: number;
  missingChannelLinks: number;
  missingSizeMappings: number;
  errors: string[];
};

type LegacyPriceRow = {
  id: string;
  menuItemId: string | null;
  menuItemSizeId: string | null;
  itemSellingChannelId: string | null;
  priceAmount: number;
  priceExpectedAmount: number;
  profitActualPerc: number;
  profitExpectedPerc: number;
  discountPercentage: number;
  showOnCardapio: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
  previousPriceAmount: number;
  MenuItem?: {
    id: string;
    name: string;
    itemId: string | null;
    visible: boolean;
  } | null;
  MenuItemSize?: {
    id: string;
    key: string | null;
    name: string;
  } | null;
  ItemSellingChannel?: {
    id: string;
    key: string;
    name: string;
  } | null;
};

function buildGroupKey(row: LegacyPriceRow) {
  return [
    String(row.MenuItem?.itemId || ""),
    String(row.menuItemSizeId || ""),
    String(row.itemSellingChannelId || ""),
  ].join("::");
}

async function resolveItemVariationIdFromLegacyRow(
  row: LegacyPriceRow,
  stats: BackfillStats
) {
  const itemId = String(row.MenuItem?.itemId || "").trim();
  if (!itemId) {
    stats.missingItemLinks += 1;
    return null;
  }

  if (!row.itemSellingChannelId) {
    stats.missingChannelLinks += 1;
    return null;
  }

  const sizeKey = String(row.MenuItemSize?.key || "").trim().toLowerCase();

  if (!sizeKey) {
    const primaryVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(itemId, {
      ensureBaseIfMissing: true,
    });

    if (!primaryVariation?.id) {
      stats.missingSizeMappings += 1;
      return null;
    }

    stats.usedBaseVariationFallback += 1;
    return primaryVariation.id;
  }

  let variation = await variationPrismaEntity.findByKindAndCode("size", sizeKey);
  if (!variation) {
    variation = await variationPrismaEntity.create({
      kind: "size",
      code: sizeKey,
      name: row.MenuItemSize?.name || sizeKey,
    });
    stats.createdSizeVariations += 1;
  }

  let itemVariation = await itemVariationPrismaEntity.findByItemAndVariation(itemId, variation.id);
  if (!itemVariation || itemVariation.deletedAt) {
    itemVariation = await itemVariationPrismaEntity.linkToItem({
      itemId,
      variationId: variation.id,
    });
    stats.linkedItemVariations += 1;
  }

  return itemVariation?.id || null;
}

export async function runBackfillLegacySellingPricesToItems() {
  const db = prismaClient as any;

  const stats: BackfillStats = {
    scannedLegacyRows: 0,
    migratedRows: 0,
    skippedRows: 0,
    channelLinksSynced: 0,
    duplicateGroups: 0,
    duplicatesSkipped: 0,
    createdSizeVariations: 0,
    linkedItemVariations: 0,
    usedBaseVariationFallback: 0,
    missingItemLinks: 0,
    missingChannelLinks: 0,
    missingSizeMappings: 0,
    errors: [],
  };

  const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();
  if (!nativeModelAvailable) {
    throw new Error("ItemSellingPriceVariation ainda não disponível no Prisma Client");
  }

  const legacyRows = (await db.menuItemSellingPriceVariation.findMany({
    where: {
      menuItemId: { not: null },
      itemSellingChannelId: { not: null },
      MenuItem: {
        is: {
          itemId: { not: null },
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      menuItemId: true,
      menuItemSizeId: true,
      itemSellingChannelId: true,
      priceAmount: true,
      priceExpectedAmount: true,
      profitActualPerc: true,
      profitExpectedPerc: true,
      discountPercentage: true,
      showOnCardapio: true,
      updatedAt: true,
      updatedBy: true,
      previousPriceAmount: true,
      MenuItem: {
        select: {
          id: true,
          name: true,
          itemId: true,
          visible: true,
        },
      },
      MenuItemSize: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
      ItemSellingChannel: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })) as LegacyPriceRow[];

  stats.scannedLegacyRows = legacyRows.length;

  const rowsByGroup = new Map<string, LegacyPriceRow[]>();
  for (const row of legacyRows) {
    const groupKey = buildGroupKey(row);
    if (!rowsByGroup.has(groupKey)) rowsByGroup.set(groupKey, []);
    rowsByGroup.get(groupKey)!.push(row);
  }

  for (const rows of rowsByGroup.values()) {
    if (rows.length > 1) {
      stats.duplicateGroups += 1;
      stats.duplicatesSkipped += rows.length - 1;
    }

    const row = rows[0];

    try {
      const itemId = String(row.MenuItem?.itemId || "").trim();
      const channelId = String(row.itemSellingChannelId || "").trim();

      if (!itemId) {
        stats.skippedRows += 1;
        stats.missingItemLinks += 1;
        continue;
      }

      if (!channelId) {
        stats.skippedRows += 1;
        stats.missingChannelLinks += 1;
        continue;
      }

      const itemVariationId = await resolveItemVariationIdFromLegacyRow(row, stats);
      if (!itemVariationId) {
        stats.skippedRows += 1;
        continue;
      }

      await itemSellingPriceVariationEntity.upsert({
        itemId,
        itemVariationId,
        itemSellingChannelId: channelId,
        priceAmount: Number(row.priceAmount || 0),
        priceExpectedAmount: Number(row.priceExpectedAmount || 0),
        profitActualPerc: Number(row.profitActualPerc || 0),
        profitExpectedPerc: Number(row.profitExpectedPerc || 0),
        discountPercentage: Number(row.discountPercentage || 0),
        published: Boolean(row.showOnCardapio),
        updatedBy: row.updatedBy || "legacy-selling-price-backfill",
      });

      if (typeof db.itemSellingChannelItem?.upsert === "function") {
        await db.itemSellingChannelItem.upsert({
          where: {
            itemId_itemSellingChannelId: {
              itemId,
              itemSellingChannelId: channelId,
            },
          },
          update: {
            visible: row.MenuItem?.visible !== false,
          },
          create: {
            itemId,
            itemSellingChannelId: channelId,
            visible: row.MenuItem?.visible !== false,
          },
        });
        stats.channelLinksSynced += 1;
      }

      stats.migratedRows += 1;
    } catch (error: any) {
      stats.skippedRows += 1;
      stats.errors.push(
        `[${row.id}] ${error?.message || "Erro inesperado ao migrar preço legado"}`
      );
    }
  }

  return stats;
}
