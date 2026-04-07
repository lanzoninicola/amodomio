import prismaClient from "~/lib/prisma/client.server";

export type ItemSellingCatalogChannel = {
  key: string;
  name: string;
  description?: string | null;
};

export type ItemSellingChannelSummary = ItemSellingCatalogChannel & {
  id: string | null;
  dbName: string | null;
  enabledForItem: boolean;
  visibleForItem: boolean;
  feeAmount: number;
  taxPerc: number;
  onlinePaymentTaxPerc: number;
  targetMarginPerc: number;
  isMarketplace: boolean;
  isConfigured: boolean;
  nativeActivePublications: number;
  legacyActivePublications: number;
  activePublications: number;
  totalPriceEntries: number;
};

export type ItemLegacyPublicationSummary = {
  id: string;
  name: string;
  active: boolean;
  visible: boolean;
  sortOrderIndex: number;
  publishedChannelKeys: string[];
};

export type ItemSellingVariationChannelPrice = {
  id: string;
  priceAmount: number;
  showOnCardapio: boolean;
  updatedAt: string | null;
  channelName: string | null;
  sourceMenuItemId: string;
  sourceMenuItemName: string;
  sourceMenuItemActive: boolean;
  sourceMenuItemVisible: boolean;
};

export type ItemSellingVariationSummary = {
  id: string;
  key: string | null;
  name: string;
  fullName: string;
  sortOrderIndex: number;
  channels: Record<string, ItemSellingVariationChannelPrice[]>;
};

export type ItemSellingPriceMatrixEntry = {
  id: string;
  name: string;
  active: boolean;
  visible: boolean;
  sourceType: "native";
  variations: ItemSellingVariationSummary[];
};

export type ItemNativePublicationSummary = {
  canSell: boolean;
  hasAnyNativePrice: boolean;
  hasAnyPublishedPrice: boolean;
  slug: string | null;
  visibleFlag: boolean;
  upcoming: boolean;
  publishedChannelKeys: string[];
  totalPriceEntries: number;
  publishedPriceEntries: number;
  visible: boolean;
};

export async function loadItemSellingOverview(params: {
  itemId: string;
}) {
  const db = prismaClient as any;
  const { itemId } = params;

  const [item, linkedMenuItems, dbChannels, itemChannelRows] = await Promise.all([
    db.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        canSell: true,
        active: true,
        ItemSellingInfo: {
          select: {
            slug: true,
            upcoming: true,
          },
        },
        ItemVariation: {
          where: { deletedAt: null },
          select: {
            id: true,
            isReference: true,
            deletedAt: true,
            Variation: {
              select: {
                id: true,
                code: true,
                name: true,
                sortOrderIndex: true,
              },
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    }),
    db.menuItem.findMany({
      where: { itemId, deletedAt: null },
      select: {
        id: true,
        name: true,
        active: true,
        visible: true,
        sortOrderIndex: true,
        MenuItemSellingPriceVariation: {
          select: {
            ItemSellingChannel: {
              select: {
                key: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    }),
    db.itemSellingChannel.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        feeAmount: true,
        taxPerc: true,
        onlinePaymentTaxPerc: true,
        targetMarginPerc: true,
        isMarketplace: true,
        sortOrderIndex: true,
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    }),
    db.itemSellingChannelItem.findMany({
      where: { itemId },
      select: {
        itemSellingChannelId: true,
        visible: true,
        ItemSellingChannel: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    }),
  ]);

  if (!item) {
    return null;
  }

  const channelByKey = new Map(
    (dbChannels || []).map((channel: any) => [String(channel.key || "").toLowerCase(), channel])
  );
  const channelLinkByKey = new Map(
    (itemChannelRows || [])
      .map((row: any) => [
        String(row.ItemSellingChannel?.key || "").toLowerCase(),
        {
          id: row.itemSellingChannelId,
          visible: row.visible !== false,
        },
      ])
      .filter(([key]: any) => Boolean(key))
  );
  const enabledChannelKeys = new Set(Array.from(channelLinkByKey.keys()));

  const nativePriceRows =
    typeof db.itemSellingPriceVariation?.findMany === "function"
      ? await db.itemSellingPriceVariation.findMany({
          where: { itemId },
          select: {
            id: true,
            priceAmount: true,
            published: true,
            updatedAt: true,
            ItemVariation: {
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
            },
            ItemSellingChannel: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
        })
      : [];
  const enabledNativePriceRows = (nativePriceRows || []).filter((row: any) =>
    enabledChannelKeys.has(String(row.ItemSellingChannel?.key || "").toLowerCase())
  );
  const nativeCardapioVisible =
    Boolean(item.canSell) &&
    Boolean(item.active) &&
    channelLinkByKey.get("cardapio")?.visible === true &&
    item.ItemSellingInfo?.upcoming !== true &&
    enabledNativePriceRows.some((row: any) => Boolean(row.published));

  const legacyPublications: ItemLegacyPublicationSummary[] = (linkedMenuItems || []).map((menuItem: any) => {
    const publishedChannelKeys = Array.from(
      new Set(
        (menuItem.MenuItemSellingPriceVariation || [])
          .map((priceRow: any) => String(priceRow.ItemSellingChannel?.key || "").toLowerCase())
          .filter(Boolean)
      )
    );

    return {
      id: menuItem.id,
      name: menuItem.name,
      active: Boolean(menuItem.active),
      visible: Boolean(menuItem.visible),
      sortOrderIndex: Number(menuItem.sortOrderIndex || 0),
      publishedChannelKeys,
    };
  });

  const channelCatalog: ItemSellingCatalogChannel[] = (dbChannels || []).map((channel: any) => ({
    key: String(channel.key || "").toLowerCase(),
    name: channel.name || String(channel.key || "").toUpperCase(),
    description: channel.description || null,
  }));

  const channels: ItemSellingChannelSummary[] = channelCatalog.map((catalogChannel) => {
    const dbChannel = channelByKey.get(catalogChannel.key) as
      | {
          id?: string | null;
          name?: string | null;
          feeAmount?: number | null;
          taxPerc?: number | null;
          onlinePaymentTaxPerc?: number | null;
          targetMarginPerc?: number | null;
          isMarketplace?: boolean | null;
        }
      | undefined;
    const legacyActivePublications = legacyPublications.filter((publication) =>
      publication.publishedChannelKeys.includes(catalogChannel.key)
    ).length;
    const nativeRows = (nativePriceRows || []).filter(
      (priceRow: any) => String(priceRow.ItemSellingChannel?.key || "").toLowerCase() === catalogChannel.key
    );
    const nativeActivePublications = nativeRows.filter((row: any) => Boolean(row.published)).length;

    const totalPriceEntries = nativeRows.length;

    return {
      ...catalogChannel,
      id: dbChannel?.id || null,
      dbName: dbChannel?.name || null,
      enabledForItem: enabledChannelKeys.has(catalogChannel.key),
      visibleForItem: channelLinkByKey.get(catalogChannel.key)?.visible === true,
      feeAmount: Number(dbChannel?.feeAmount || 0),
      taxPerc: Number(dbChannel?.taxPerc || 0),
      onlinePaymentTaxPerc: Number(dbChannel?.onlinePaymentTaxPerc || 0),
      targetMarginPerc: Number(dbChannel?.targetMarginPerc || 0),
      isMarketplace: Boolean(dbChannel?.isMarketplace),
      isConfigured: Boolean(dbChannel),
      nativeActivePublications,
      legacyActivePublications,
      activePublications: legacyActivePublications + nativeActivePublications,
      totalPriceEntries,
    };
  });

  const nativeVariationMap = new Map<string, ItemSellingVariationSummary>();

  for (const itemVariation of item?.ItemVariation || []) {
    if (itemVariation?.deletedAt) continue;
    nativeVariationMap.set(String(itemVariation.id), {
      id: itemVariation.id,
      key: itemVariation.Variation?.code || null,
      name: itemVariation.Variation?.name || "Sem variacao",
      fullName: itemVariation.Variation?.name || "Sem variacao",
      sortOrderIndex: itemVariation.isReference
        ? -1
        : Number(itemVariation.Variation?.sortOrderIndex || 0),
      channels: {},
    });
  }

  for (const nativeRow of nativePriceRows || []) {
    const itemVariation = nativeRow.ItemVariation;
    if (!itemVariation?.id) continue;

    if (!nativeVariationMap.has(itemVariation.id)) {
      nativeVariationMap.set(itemVariation.id, {
        id: itemVariation.id,
        key: itemVariation.Variation?.code || null,
        name: itemVariation.Variation?.name || "Sem variacao",
        fullName: itemVariation.Variation?.name || "Sem variacao",
        sortOrderIndex: itemVariation.isReference
          ? -1
          : Number(itemVariation.Variation?.sortOrderIndex || 0),
        channels: {},
      });
    }

    const channelKey = String(nativeRow.ItemSellingChannel?.key || "").toLowerCase();
    if (!channelKey) continue;
    if (!enabledChannelKeys.has(channelKey)) continue;

    const current = nativeVariationMap.get(itemVariation.id)!;
    if (!current.channels[channelKey]) current.channels[channelKey] = [];

    current.channels[channelKey].push({
      id: nativeRow.id,
      priceAmount: Number(nativeRow.priceAmount || 0),
      showOnCardapio: Boolean(nativeRow.published),
      updatedAt: nativeRow.updatedAt ? new Date(nativeRow.updatedAt).toISOString() : null,
      channelName: nativeRow.ItemSellingChannel?.name || null,
      sourceMenuItemId: item.id,
      sourceMenuItemName: item.name,
      sourceMenuItemActive: Boolean(item.canSell && item.active),
      sourceMenuItemVisible:
        Boolean(item.canSell) &&
        Boolean(item.active) &&
        channelLinkByKey.get(channelKey)?.visible === true &&
        item.ItemSellingInfo?.upcoming !== true &&
        Boolean(nativeRow.published),
    });
  }

  const sellingMatrix: ItemSellingPriceMatrixEntry[] = [
    {
      id: item.id,
      name: item.name,
      active: Boolean(item.canSell && item.active),
      visible: nativeCardapioVisible,
      sourceType: "native",
      variations: Array.from(nativeVariationMap.values()).sort(
        (a, b) => Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0)
      ),
    },
  ];
  const nativePublishedChannelKeys = Array.from(
    new Set(
      (nativePriceRows || [])
        .filter((row: any) => Boolean(row.published))
        .map((row: any) => String(row.ItemSellingChannel?.key || "").toLowerCase())
        .filter((key: string) => Boolean(key) && enabledChannelKeys.has(key))
    )
  ) as string[];
  const nativePublication: ItemNativePublicationSummary = {
    canSell: Boolean(item.canSell),
    hasAnyNativePrice: enabledNativePriceRows.length > 0,
    hasAnyPublishedPrice: enabledNativePriceRows.some((row: any) => Boolean(row.published)),
    slug: item.ItemSellingInfo?.slug || null,
    visibleFlag: channelLinkByKey.get("cardapio")?.visible === true,
    upcoming: item.ItemSellingInfo?.upcoming === true,
    publishedChannelKeys: nativePublishedChannelKeys,
    totalPriceEntries: enabledNativePriceRows.length,
    publishedPriceEntries: enabledNativePriceRows.filter((row: any) => Boolean(row.published)).length,
    visible: nativeCardapioVisible,
  };

  return {
    item,
    channels,
    legacyPublications,
    nativePublication,
    sellingMatrix,
    sellingSource: "native" as const,
    nativePricingReady: nativePriceRows.length > 0,
  };
}
