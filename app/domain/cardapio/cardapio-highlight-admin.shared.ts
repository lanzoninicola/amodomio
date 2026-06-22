export type CardapioHighlightAdminImage = {
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
};

export const DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR = "#ffffff";
export const DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR = "#111111";

function normalizeHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export function getCardapioHighlightAdminImages(
  value: unknown
): CardapioHighlightAdminImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as CardapioHighlightAdminImage;
      const imageUrl = String(source.imageUrl || "").trim();
      if (!imageUrl) return null;
      return {
        imageUrl,
        fullscreenImageUrl:
          String(source.fullscreenImageUrl || "").trim() || imageUrl,
        alt: String(source.alt || "").trim() || null,
        linkUrl: String(source.linkUrl || "").trim() || null,
        linkText: String(source.linkText || "").trim() || null,
        linkBackgroundColor: normalizeHexColor(
          String(source.linkBackgroundColor || ""),
          DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR
        ),
        linkTextColor: normalizeHexColor(
          String(source.linkTextColor || ""),
          DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR
        ),
      };
    })
    .filter((item): item is CardapioHighlightAdminImage => Boolean(item));
}

export function parseCardapioHighlightAdminImages(
  form: FormData,
  title: string
) {
  const imageUrls = String(form.get("imageUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim())
    .filter(Boolean);
  const fullscreenUrls = String(form.get("fullscreenImageUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim());

  return imageUrls.map((imageUrl, index) => ({
    imageUrl,
    fullscreenImageUrl: fullscreenUrls[index]?.trim() || imageUrl,
    alt: `${title}, imagem ${index + 1}`,
    linkUrl: String(form.get(`linkUrl_${index}`) || "").trim() || null,
    linkText: String(form.get(`linkText_${index}`) || "").trim() || null,
    linkBackgroundColor: normalizeHexColor(
      String(form.get(`linkBackgroundColor_${index}`) || ""),
      DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR
    ),
    linkTextColor: normalizeHexColor(
      String(form.get(`linkTextColor_${index}`) || ""),
      DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR
    ),
  }));
}
