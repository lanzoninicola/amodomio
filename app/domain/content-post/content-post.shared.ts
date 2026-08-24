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
  selectedMediaKeys: string[] | null;
  mediaConfigByKey: Record<string, CardapioFeaturedMediaConfig>;
};

export type CardapioFeaturedMediaConfig = {
  linkUrl: string | null;
  linkText: string | null;
  linkMenuItemId: string | null;
  linkBackgroundColor: string | null;
  linkTextColor: string | null;
  linkPosition: "top" | "bottom";
  linkNewTab: boolean;
  chipAction: "link" | "none" | "modal";
  chipModalTitle: string | null;
  chipModalBody: string | null;
};

export const DEFAULT_CARDAPIO_FEATURED_CONFIG: CardapioFeaturedConfig = {
  displayStyle: "polaroid",
  showTitle: true,
  showPromotionHint: true,
  promotionHintText: null,
  selectedMediaKeys: null,
  mediaConfigByKey: {},
};

function nullableString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseCardapioFeaturedMediaConfig(
  value: unknown
): CardapioFeaturedMediaConfig {
  const source = value && typeof value === "object" ? (value as any) : {};
  return {
    linkUrl: nullableString(source.linkUrl),
    linkText: nullableString(source.linkText),
    linkMenuItemId: nullableString(source.linkMenuItemId),
    linkBackgroundColor: nullableString(source.linkBackgroundColor),
    linkTextColor: nullableString(source.linkTextColor),
    linkPosition: source.linkPosition === "bottom" ? "bottom" : "top",
    linkNewTab: source.linkNewTab !== false,
    chipAction:
      source.chipAction === "none" || source.chipAction === "modal"
        ? source.chipAction
        : "link",
    chipModalTitle: nullableString(source.chipModalTitle),
    chipModalBody: nullableString(source.chipModalBody),
  };
}

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
    selectedMediaKeys: Array.isArray(source.selectedMediaKeys)
      ? Array.from(
          new Set(
            source.selectedMediaKeys.filter(
              (key): key is string => typeof key === "string" && Boolean(key)
            )
          )
        )
      : null,
    mediaConfigByKey:
      source.mediaConfigByKey && typeof source.mediaConfigByKey === "object"
        ? Object.fromEntries(
            Object.entries(source.mediaConfigByKey).map(([key, config]) => [
              key,
              parseCardapioFeaturedMediaConfig(config),
            ])
          )
        : {},
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
