export type CardapioPriceVariation = {
  id: string;
  label: string;
  priceAmount: number;
  sortOrderIndex?: number | null;
  isReference?: boolean | null;
  showOnCardapio?: boolean | null;
  profitExpectedPerc?: number | null;
};

export type CardapioMedia = {
  isPrimary?: boolean | null;
  secureUrl?: string | null;
  thumbnailUrl?: string | null;
  variants?: Record<string, string> | null;
  kind?: string | null;
};

export type CardapioPublicTag = {
  id?: string | null;
  name: string;
  colorHEX?: string | null;
  description?: string | null;
  clickable?: boolean | null;
};

export type CardapioTagValue = string | CardapioPublicTag;

export function buildImageSrcSet(
  variants: Record<string, string> | null | undefined
): string {
  if (!variants) return "";
  return Object.entries(variants)
    .filter(([w, url]) => /^\d+$/.test(w) && Boolean(url))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([w, url]) => `${url} ${w}w`)
    .join(", ");
}

export type CardapioIndexItem = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  longDescription?: string | null;
  baseIngredients?: string | null;
  ingredients?: string | null;
  imagePlaceholderURL?: string | null;
  mediaAssets?: CardapioMedia[] | null;
  publicPriceVariations?: CardapioPriceVariation[] | null;
  tags?: {
    all?: CardapioTagValue[] | null;
    public?: CardapioTagValue[] | null;
  } | null;
  likes?: {
    amount?: number | null;
  } | null;
  group?: {
    description?: string | null;
  } | null;
};

export type GroupedItems = {
  productLineId: string;
  productLine: string;
  productLineDescription?: string | null;
  productLineSortOrderIndex?: number | null;
  groupId: string;
  group: string;
  description?: string | null;
  sortOrderIndex?: number | null;
  items: CardapioIndexItem[];
};

export function getVisiblePublicPriceVariations(item: CardapioIndexItem) {
  const variations = item.publicPriceVariations ?? [];
  const visibleVariations = variations.filter(
    (variation) => variation.showOnCardapio
  );
  return visibleVariations.length > 0 ? visibleVariations : variations;
}

export function getPrimaryCardapioMedia(item: CardapioIndexItem) {
  return (
    item.mediaAssets?.find((img) => img.isPrimary) || item.mediaAssets?.[0]
  );
}

export function getGroupedItemsList(group: GroupedItems) {
  return group.items;
}

export function getGroupedItemsDescription(group: GroupedItems) {
  return (
    group.description?.trim() ||
    group.items[0]?.group?.description?.trim() ||
    ""
  );
}

export function itemHasPublicTag(
  item: Pick<CardapioIndexItem, "tags">,
  tagName: string
) {
  const normalized = tagName.trim().toLocaleLowerCase();
  return [...(item.tags?.public || []), ...(item.tags?.all || [])].some(
    (tag) => getCardapioTagName(tag).toLocaleLowerCase() === normalized
  );
}

export function getCardapioTagName(tag: CardapioTagValue | null | undefined) {
  if (!tag) return "";
  return typeof tag === "string" ? tag.trim() : tag.name?.trim() || "";
}

export function getCardapioPublicTag(
  tag: CardapioTagValue | null | undefined
): CardapioPublicTag | null {
  if (!tag || typeof tag === "string") return null;
  const name = tag.name?.trim();
  if (!name) return null;
  return { ...tag, name };
}

export function isGrouped(
  items: CardapioIndexItem[] | GroupedItems[]
): items is GroupedItems[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    "items" in (items[0] as Record<string, unknown>)
  );
}

export function getNoveltyItems(input: CardapioIndexItem[] | GroupedItems[]) {
  const flatItems = isGrouped(input)
    ? input.flatMap((group) => group.items)
    : input;

  return [...flatItems]
    .filter((item) => itemHasPublicTag(item, "novidade"))
    .sort((a, b) => {
      const aHasImage = getPrimaryCardapioMedia(a)?.secureUrl ? 1 : 0;
      const bHasImage = getPrimaryCardapioMedia(b)?.secureUrl ? 1 : 0;
      const likesDiff = (b.likes?.amount || 0) - (a.likes?.amount || 0);
      return bHasImage - aHasImage || likesDiff;
    });
}

export function getCardapioItemHref(
  item: Pick<CardapioIndexItem, "id" | "slug">
) {
  const identifier = item.slug?.trim() || item.id;
  return `/cardapio/${encodeURIComponent(identifier)}`;
}

export function getCardapioItemAnchorHref(item: { slug: string }) {
  return `/cardapio#${encodeURIComponent(item.slug)}`;
}

export function getCardapioInterestItemId(item: CardapioIndexItem) {
  return item.id;
}

export function getItemMarginPerc(item: CardapioIndexItem) {
  const source = getVisiblePublicPriceVariations(item);
  if (!source.length) return 0;
  return Math.max(
    ...source.map((variation) => Number(variation.profitExpectedPerc ?? 0))
  );
}

export function buildRandomGroups<T>(items: T[], size: number) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups: T[][] = [];
  for (let i = 0; i < shuffled.length; i += size) {
    groups.push(shuffled.slice(i, i + size));
  }
  return groups;
}
