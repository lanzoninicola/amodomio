export const CONTENT_POST_CHANNELS = {
  CARDAPIO_FEATURED: "cardapio-featured",
  WHATSAPP_STATUS: "whatsapp-status",
  INSTAGRAM_STORY: "instagram-story",
} as const;

export type ContentPostChannel =
  (typeof CONTENT_POST_CHANNELS)[keyof typeof CONTENT_POST_CHANNELS];

export const CONTENT_POST_STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type ContentPostStatus =
  (typeof CONTENT_POST_STATUSES)[keyof typeof CONTENT_POST_STATUSES];

export type CardapioFeaturedConfig = {
  displayStyle: "polaroid" | "default";
  showTitle: boolean;
  showPromotionHint: boolean;
  promotionHintText: string | null;
};

export const DEFAULT_CARDAPIO_FEATURED_CONFIG: CardapioFeaturedConfig = {
  displayStyle: "polaroid",
  showTitle: true,
  showPromotionHint: true,
  promotionHintText: null,
};

export function parseCardapioFeaturedConfig(
  value: unknown
): CardapioFeaturedConfig {
  const source =
    value && typeof value === "object"
      ? (value as Partial<CardapioFeaturedConfig>)
      : {};

  return {
    displayStyle: source.displayStyle === "default" ? "default" : "polaroid",
    showTitle: source.showTitle !== false,
    showPromotionHint: source.showPromotionHint !== false,
    promotionHintText:
      typeof source.promotionHintText === "string"
        ? source.promotionHintText.trim() || null
        : null,
  };
}

export function slugifyContentPostKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function buildContentTargetPublishEndpoint(
  origin: string,
  targetId: string
) {
  return new URL(
    `/api/content-publication-targets/${encodeURIComponent(targetId)}/publish`,
    origin
  ).toString();
}
