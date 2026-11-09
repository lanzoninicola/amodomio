export type ContentPostMediaInput = {
  key: string;
  title: string;
  kind: "image" | "video";
  mediaUrl: string;
  fullscreenMediaUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkMenuItemId?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
  linkPosition?: string | null;
  linkNewTab?: boolean;
  chipAction?: string | null;
  chipModalTitle?: string | null;
  chipModalBody?: string | null;
  sortOrder: number;
};

export const DEFAULT_CONTENT_LINK_BACKGROUND_COLOR = "#ffffff";
export const DEFAULT_CONTENT_LINK_TEXT_COLOR = "#111111";

function normalizeHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export function parseContentPostMediaForm(
  form: FormData,
  title: string
): ContentPostMediaInput[] {
  const mediaUrls = String(form.get("mediaUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim())
    .filter(Boolean);
  const fullscreenUrls = String(form.get("fullscreenMediaUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim());

  return mediaUrls.map((mediaUrl, index) => {
    const rawLinkMode = String(form.get(`linkMode_${index}`) || "external");
    const linkMode =
      rawLinkMode === "none" ||
      rawLinkMode === "item" ||
      rawLinkMode === "modal"
        ? rawLinkMode
        : "free";
    const linkMenuItemId =
      linkMode === "item"
        ? String(form.get(`linkMenuItemId_${index}`) || "").trim() || null
        : null;
    const chipAction =
      linkMode === "none" ? "none" : linkMode === "modal" ? "modal" : "link";

    return {
      key: String(index),
      title: `${title} — mídia ${index + 1}`,
      kind: /\.(mp4|mov|webm)(?:$|\?)/i.test(mediaUrl) ? "video" : "image",
      mediaUrl,
      fullscreenMediaUrl: fullscreenUrls[index]?.trim() || mediaUrl,
      alt: `${title}, mídia ${index + 1}`,
      linkUrl: linkMenuItemId
        ? null
        : chipAction === "modal"
        ? null
        : String(form.get(`linkUrl_${index}`) || "").trim() || null,
      linkText:
        chipAction === "none"
          ? null
          : String(form.get(`linkText_${index}`) || "").trim() || null,
      linkMenuItemId,
      linkBackgroundColor: normalizeHexColor(
        String(form.get(`linkBackgroundColor_${index}`) || ""),
        DEFAULT_CONTENT_LINK_BACKGROUND_COLOR
      ),
      linkTextColor: normalizeHexColor(
        String(form.get(`linkTextColor_${index}`) || ""),
        DEFAULT_CONTENT_LINK_TEXT_COLOR
      ),
      linkPosition:
        String(form.get(`linkPosition_${index}`) || "top") === "bottom"
          ? "bottom"
          : "top",
      linkNewTab: form.get(`linkNewTab_${index}`) !== "false",
      chipAction,
      chipModalTitle:
        chipAction === "modal"
          ? String(form.get(`chipModalTitle_${index}`) || "").trim() || null
          : null,
      chipModalBody:
        chipAction === "modal"
          ? String(form.get(`chipModalBody_${index}`) || "").trim() || null
          : null,
      sortOrder: index,
    };
  });
}
