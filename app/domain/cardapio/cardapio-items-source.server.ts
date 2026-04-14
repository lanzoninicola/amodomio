import prismaClient from "~/lib/prisma/client.server";
import {
  MenuItemEntityFindAllOptions,
  MenuItemEntityFindAllParams,
  MenuItemWithAssociations,
} from "./menu-item.prisma.entity.server";

type CardapioCompatItem = MenuItemWithAssociations & {
  sourceType?: "native";
  sourceItemId?: string;
};

type NativeCardapioRow = Awaited<ReturnType<typeof listNativeCardapioItems>>[number];
type CompatTagModel = {
  id: string;
  name: string | null;
  public: boolean;
};
type CompatMediaAsset = {
  id?: string | null;
  kind?: string | null;
  secureUrl?: string | null;
  thumbnailUrl?: string | null;
  isPrimary?: boolean | null;
  visible?: boolean | null;
  sortOrder?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isCloudinaryUrl(url?: string | null) {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(normalizeText(url));
}

function normalizePublicMediaUrl(url?: string | null) {
  const normalized = normalizeText(url);
  if (!normalized) return "";
  return isCloudinaryUrl(normalized) ? "" : normalized;
}

function isVideoMedia(media?: { kind?: string | null; secureUrl?: string | null } | null) {
  const kind = normalizeText(media?.kind).toLowerCase();
  if (kind === "video") return true;
  return /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(normalizePublicMediaUrl(media?.secureUrl));
}

function uniqueById<T extends { id?: string | null }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = normalizeText(row?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function buildMetaFromTags(tags: Array<{ name?: string | null }>) {
  const names = uniqueStrings(tags.map((tag) => tag?.name || ""));
  const hasTag = (tagName: string) => names.some((value) => value.toLowerCase() === tagName.toLowerCase());

  return {
    isItalyProduct: hasTag("produtos-italiano"),
    isBestSeller: hasTag("mais-vendido"),
    isMonthlyBestSeller: hasTag("mais-vendido-mes"),
    isChefSpecial: hasTag("especial-chef"),
    isMonthlySpecial: hasTag("especial-mes"),
  };
}

function getFeaturedMedia(galleryAssets?: CompatMediaAsset[] | null) {
  const gallery = (galleryAssets || []).filter(
    (asset: any) => asset?.visible !== false && Boolean(normalizePublicMediaUrl(asset?.secureUrl))
  );
  if (!gallery.length) return null;
  return gallery.find((asset: any) => asset?.isPrimary) || gallery[0] || null;
}

function getPrimaryImageMedia(galleryAssets?: CompatMediaAsset[] | null) {
  return (
    (galleryAssets || []).find(
      (asset: any) =>
        asset?.visible !== false &&
        Boolean(normalizePublicMediaUrl(asset?.secureUrl)) &&
        !isVideoMedia(asset)
    ) || null
  );
}

function mapCompatGalleryAssets(assets?: CompatMediaAsset[] | null) {
  return (assets || []).map((asset, index) => ({
    id: asset?.id || `compat-media-${index}`,
    kind: asset?.kind || "image",
    secureUrl: asset?.secureUrl || null,
    thumbnailUrl: asset?.thumbnailUrl || null,
    isPrimary: Boolean(asset?.isPrimary),
    visible: asset?.visible !== false,
    sortOrder: Number(asset?.sortOrder || 0),
    createdAt: asset?.createdAt || new Date(),
    updatedAt: asset?.updatedAt || asset?.createdAt || new Date(),
  }));
}

function resolveCompatMedia(input: {
  galleryAssets?: CompatMediaAsset[] | null;
}) {
  const galleryAssets = input.galleryAssets;
  const featured = getFeaturedMedia(galleryAssets);
  const imageAsset = getPrimaryImageMedia(galleryAssets);
  const mediaUrl = normalizePublicMediaUrl(featured?.secureUrl);
  const imageUrl = normalizePublicMediaUrl(imageAsset?.secureUrl) || mediaUrl;
  const placeholderUrl = normalizePublicMediaUrl(imageAsset?.thumbnailUrl);

  return { mediaUrl, imageUrl, placeholderUrl };
}

function resolveSortOrderIndex(row: NativeCardapioRow["ItemVariation"][number], fallbackIndex: number) {
  if (row?.isReference) return -1;
  if (row?.Variation?.code === "base") return -1;
  return fallbackIndex + 1;
}

function buildCompatPriceRows(item: NativeCardapioRow) {
  return (item.ItemSellingPriceVariation || [])
    .map((row: any, index: number) => {
      const label = row.ItemVariation?.Variation?.name || "Sem variacao";
      const code = row.ItemVariation?.Variation?.code || null;
      const sortOrderIndex = resolveSortOrderIndex(row.ItemVariation, index);

      return {
        id: row.id,
        menuItemId: item.id,
        menuItemSizeId: row.ItemVariation?.id || row.id,
        itemSellingChannelId: row.ItemSellingChannel?.id || null,
        priceAmount: Number(row.priceAmount || 0),
        profitActualPerc: Number(row.profitActualPerc || 0),
        priceExpectedAmount: Number(row.priceExpectedAmount || 0),
        profitExpectedPerc: Number(row.profitExpectedPerc || 0),
        discountPercentage: Number(row.discountPercentage || 0),
        previousPriceAmount: Number(row.previousPriceAmount || 0),
        showOnCardapio: Boolean(row.published),
        showOnCardapioAt: row.publishedAt || row.updatedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy || null,
        ItemSellingChannel: row.ItemSellingChannel ? { ...row.ItemSellingChannel } : null,
        MenuItemSize: {
          id: row.ItemVariation?.id || row.id,
          key: code,
          name: label,
          nameShort: label,
          nameAbbreviated: label,
          sortOrderIndex,
          description: null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          pizzaDoughCostAmount: 0,
          packagingCostAmount: 0,
          visible: true,
          visibleAdmin: true,
          maxToppingsAmount: 0,
          maxToppingsAmountDescription: null,
          maxServeAmount: 0,
          maxServeAmountDescription: null,
          group: null,
        },
      };
    })
    .sort(
      (a: any, b: any) =>
        Number(a.MenuItemSize?.sortOrderIndex || 0) - Number(b.MenuItemSize?.sortOrderIndex || 0) ||
        Number(a.priceAmount || 0) - Number(b.priceAmount || 0)
    );
}

function buildPriceVariations(
  sellingPrices: Array<{
    id: string;
    priceAmount: number;
    showOnCardapio: boolean;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    updatedBy?: string | null;
    discountPercentage?: number;
    MenuItemSize?: { id?: string; nameShort?: string | null; name?: string | null } | null;
  }>
) {
  return sellingPrices.map((row) => ({
    id: row.id,
    menuItemId: null,
    menuItemVariationId: null,
    label: row.MenuItemSize?.nameShort || row.MenuItemSize?.name || "Sem variacao",
    basePrice: Number(row.priceAmount || 0),
    amount: Number(row.priceAmount || 0),
    discountPercentage: Number(row.discountPercentage || 0),
    showOnCardapio: Boolean(row.showOnCardapio),
    showOnCardapioAt: row.updatedAt || row.createdAt || null,
    createdAt: row.createdAt || row.updatedAt || new Date(),
    updatedAt: row.updatedAt || row.createdAt || new Date(),
    updatedBy: row.updatedBy || null,
    latestAmount: Number(row.priceAmount || 0),
    menuItemSizeId: row.MenuItemSize?.id || null,
  }));
}

function applyCompatMenuItemFilters(
  records: CardapioCompatItem[],
  where?: MenuItemEntityFindAllParams["where"]
) {
  if (!where) return records;
  const filters = where as Record<string, unknown>;

  return records.filter((record) => {
    if (typeof filters.id === "string" && record.id !== filters.id) return false;
    if (typeof filters.active === "boolean" && Boolean(record.active) !== filters.active) return false;
    if (typeof filters.visible === "boolean" && Boolean(record.visible) !== filters.visible) return false;
    if (typeof filters.upcoming === "boolean" && Boolean(record.upcoming) !== filters.upcoming) return false;
    if (typeof filters.categoryId === "string" && String(record.categoryId || "") !== filters.categoryId) return false;
    if (
      typeof filters.menuItemGroupId === "string" &&
      String((record as any).menuItemGroupId || "") !== filters.menuItemGroupId
    ) {
      return false;
    }

    return true;
  });
}

function sortCompatMenuItems(records: CardapioCompatItem[], params: MenuItemEntityFindAllParams = {}) {
  if (!params?.option?.sorted) return [...records];
  const direction = params.option?.direction === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    return (
      (Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0)) * direction ||
      a.name.localeCompare(b.name)
    );
  });
}

function toCompatCardapioItem(item: NativeCardapioRow): CardapioCompatItem {
  const sellingInfo = item.ItemSellingInfo;
  const category = sellingInfo?.Category || { id: "", name: "Sem categoria", type: "menu" };
  const group = sellingInfo?.ItemGroup || {
    id: "__sem_grupo__",
    key: null,
    name: "Sem grupo",
    description: "",
    sortOrderIndex: Number.MAX_SAFE_INTEGER,
  };

  const allTags = uniqueById<CompatTagModel>(
    (item.ItemTag || []).map((tagRow: any) => tagRow.Tag).filter((tag: any) => Boolean(tag?.id))
  );
  const publicTags = allTags.filter((tag) => tag.public === true);
  const galleryAssets = mapCompatGalleryAssets(item.ItemGalleryImage as CompatMediaAsset[] | null | undefined);
  const media = resolveCompatMedia({ galleryAssets });
  const compatMenuItemImage =
    media.imageUrl || media.placeholderUrl
      ? {
          secureUrl: media.imageUrl || null,
          thumbnailUrl: media.placeholderUrl || media.imageUrl || null,
        }
      : null;
  const sellingPrices = buildCompatPriceRows(item);

  const hasPublishedNativePrice = sellingPrices.some((row: any) => Boolean(row.showOnCardapio));
  const cardapioChannelVisible =
    (item.ItemSellingChannelItem || []).some((row: any) => row?.visible === true) || false;
  const nativeUpcoming = Boolean(sellingInfo?.upcoming);
  const active = Boolean(item.active && item.canSell);
  const visible =
    Boolean(item.canSell) &&
    Boolean(item.active) &&
    cardapioChannelVisible &&
    !nativeUpcoming &&
    hasPublishedNativePrice;

  return {
    id: item.id,
    name: item.name,
    description: normalizeText(item.description),
    longDescription: normalizeText(sellingInfo?.longDescription) || null,
    ingredients: normalizeText(sellingInfo?.ingredients),
    categoryId: category.id || "",
    Category: category as any,
    itemId: item.id,
    Item: { id: item.id, name: item.name } as any,
    basePriceAmount: Number(sellingPrices[0]?.priceAmount || 0),
    visible,
    active,
    upcoming: nativeUpcoming,
    mogoId: "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: null,
    deletedBy: null,
    tags: {
      all: allTags.map((tag) => tag.name || ""),
      public: publicTags.map((tag) => tag.name || ""),
      models: allTags as any,
    },
    MenuItemLike: [] as any,
    MenuItemShare: [] as any,
    MenuItemInterestEvent: [] as any,
    imageId: galleryAssets[0]?.id || null,
    MenuItemImage: compatMenuItemImage as any,
    MenuItemNote: [] as any,
    MenuItemSellingPriceVariation: sellingPrices as any,
    MenuItemCostVariation: [] as any,
    priceVariations: buildPriceVariations(sellingPrices as any) as any,
    MenuItemGroup: group as any,
    menuItemGroupId: group?.id || null,
    MenuItemSellingPriceVariationAudit: [] as any,
    MenuItemGalleryImage: galleryAssets as any,
    CostImpactMenuItem: [] as any,
    sortOrderIndex: 0,
    notesPublic: normalizeText(sellingInfo?.notesPublic) || null,
    slug: normalizeText(sellingInfo?.slug) || item.id,
    likes: { amount: Number(item.ItemLike?.length || 0) },
    shares: { amount: Number(item._count?.ItemShare || 0) },
    imageTransformedURL: media.imageUrl,
    imagePlaceholderURL: media.placeholderUrl,
    meta: buildMetaFromTags(allTags),
    sourceType: "native",
    sourceItemId: item.id,
  } as CardapioCompatItem;
}

function buildNativeCardapioItemWhere(params: MenuItemEntityFindAllParams = {}) {
  const legacyWhere = (params.where || {}) as Record<string, unknown>;
  const sellingChannelKey = params.sellingChannelKey || "cardapio";
  const where: Record<string, unknown> = {
    canSell: true,
    ItemSellingChannelItem: {
      some: {
        ItemSellingChannel: {
          key: sellingChannelKey,
        },
      },
    },
  };

  if (typeof legacyWhere.active === "boolean") {
    where.active = legacyWhere.active;
  }

  if (typeof legacyWhere.itemId === "string" && legacyWhere.itemId.trim()) {
    where.id = legacyWhere.itemId.trim();
  }

  return where;
}

async function listNativeCardapioItems(
  params: MenuItemEntityFindAllParams = {},
  _options: MenuItemEntityFindAllOptions = {}
) {
  const db = prismaClient as any;
  const sellingChannelKey = params.sellingChannelKey || "cardapio";

  return await db.item.findMany({
    where: buildNativeCardapioItemWhere(params),
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      canSell: true,
      createdAt: true,
      updatedAt: true,
      ItemSellingInfo: {
        select: {
          id: true,
          ingredients: true,
          longDescription: true,
          notesPublic: true,
          slug: true,
          upcoming: true,
          categoryId: true,
          itemGroupId: true,
          Category: {
            select: { id: true, name: true, type: true },
          },
          ItemGroup: {
            select: { id: true, key: true, name: true, description: true, sortOrderIndex: true },
          },
        },
      },
      ItemSellingChannelItem: {
        where: {
          ItemSellingChannel: { key: sellingChannelKey },
        },
        select: { id: true, visible: true, itemSellingChannelId: true },
      },
      ItemGalleryImage: {
        where: { visible: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          kind: true,
          secureUrl: true,
          thumbnailUrl: true,
          isPrimary: true,
          visible: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      ItemTag: {
        where: { deletedAt: null },
        select: {
          id: true,
          Tag: { select: { id: true, name: true, public: true } },
        },
      },
      ItemLike: {
        where: { deletedAt: null, amount: { gt: 0, lte: 1 } },
        select: { id: true },
      },
      _count: {
        select: { ItemShare: true },
      },
      ItemVariation: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          isReference: true,
          Variation: { select: { id: true, code: true, name: true } },
        },
      },
      ItemSellingPriceVariation: {
        where: {
          ItemSellingChannel: { key: sellingChannelKey },
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          priceAmount: true,
          profitActualPerc: true,
          priceExpectedAmount: true,
          profitExpectedPerc: true,
          discountPercentage: true,
          previousPriceAmount: true,
          published: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
          ItemVariation: {
            select: {
              id: true,
              isReference: true,
              Variation: { select: { id: true, code: true, name: true } },
            },
          },
          ItemSellingChannel: {
            select: { id: true, key: true, name: true },
          },
        },
      },
    },
  });
}

async function findAllCardapioItemsFromSource(
  params: MenuItemEntityFindAllParams = {},
  options: MenuItemEntityFindAllOptions = {}
) {
  const rows = await listNativeCardapioItems(params, options);
  const compatItems = rows.map(toCompatCardapioItem);
  const filtered = applyCompatMenuItemFilters(compatItems, params.where);
  return sortCompatMenuItems(filtered, params);
}

export async function findAllCardapioItems(
  params: MenuItemEntityFindAllParams = {},
  options: MenuItemEntityFindAllOptions = {}
): Promise<MenuItemWithAssociations[]> {
  return (await findAllCardapioItemsFromSource(params, options)) as MenuItemWithAssociations[];
}

export async function findAllCardapioItemsGroupedByGroupLight(
  params: MenuItemEntityFindAllParams = {},
  options: MenuItemEntityFindAllOptions = {}
) {
  const allItems = await findAllCardapioItemsFromSource(params, options);
  const direction = params.option?.direction === "desc" ? -1 : 1;

  const grouped = allItems.reduce(
    (acc, item) => {
      const group = item.MenuItemGroup;
      const key = group?.id || "__sem_grupo__";

      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: group?.name || "Sem grupo",
          description: group?.description || "",
          sortOrderIndex:
            typeof group?.sortOrderIndex === "number" ? group.sortOrderIndex : Number.MAX_SAFE_INTEGER,
          items: [] as CardapioCompatItem[],
        };
      }

      acc[key].items.push(item);
      return acc;
    },
    {} as Record<
      string,
      {
        id: string;
        name: string;
        description: string;
        sortOrderIndex: number;
        items: CardapioCompatItem[];
      }
    >
  );

  return Object.values(grouped)
    .sort(
      (a, b) =>
        (a.sortOrderIndex - b.sortOrderIndex) * direction || a.name.localeCompare(b.name)
    )
    .map((group) => ({
      groupId: group.id,
      group: group.name,
      description: group.description,
      sortOrderIndex: group.sortOrderIndex,
      menuItems: group.items,
    }));
}

export async function findCardapioItemBySlug(slug: string) {
  const normalizedSlug = normalizeText(slug);
  if (!normalizedSlug) return null;

  const db = prismaClient as any;
  const item = await db.item.findFirst({
    where: {
      OR: [
        { id: normalizedSlug },
        { ItemSellingInfo: { is: { slug: normalizedSlug } } },
      ],
    },
    select: { id: true },
  });

  if (!item) return null;

  const rows = await listNativeCardapioItems({ where: { itemId: item.id } as any }, {});
  return rows.length ? toCompatCardapioItem(rows[0]) : null;
}
