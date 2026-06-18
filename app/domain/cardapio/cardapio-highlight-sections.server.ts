import prismaClient from "~/lib/prisma/client.server";

export type CardapioHighlightImage = {
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
};

const DEFAULT_LINK_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_LINK_TEXT_COLOR = "#111111";

function normalizeHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export type CardapioHighlightDisplayStyle = "polaroid" | "default";

export type CardapioHighlightSection = {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  displayStyle: CardapioHighlightDisplayStyle;
  showTitle: boolean;
  images: CardapioHighlightImage[];
};

function parseImageItems(value: unknown): CardapioHighlightImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const imageUrl = String(
        (item as { imageUrl?: unknown }).imageUrl || ""
      ).trim();
      if (!imageUrl) return null;

      const fullscreenImageUrl = String(
        (item as { fullscreenImageUrl?: unknown }).fullscreenImageUrl || ""
      ).trim();
      const alt = String((item as { alt?: unknown }).alt || "").trim();
      const linkUrl = String(
        (item as { linkUrl?: unknown }).linkUrl || ""
      ).trim();
      const linkText = String(
        (item as { linkText?: unknown }).linkText || ""
      ).trim();
      const linkBackgroundColor = String(
        (item as { linkBackgroundColor?: unknown }).linkBackgroundColor || ""
      ).trim();
      const linkTextColor = String(
        (item as { linkTextColor?: unknown }).linkTextColor || ""
      ).trim();

      return {
        imageUrl,
        fullscreenImageUrl: fullscreenImageUrl || null,
        alt: alt || null,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        linkBackgroundColor: normalizeHexColor(
          linkBackgroundColor,
          DEFAULT_LINK_BACKGROUND_COLOR
        ),
        linkTextColor: normalizeHexColor(
          linkTextColor,
          DEFAULT_LINK_TEXT_COLOR
        ),
      };
    })
    .filter((item): item is CardapioHighlightImage => Boolean(item));
}

export async function findPublishedCardapioHighlightSections(): Promise<
  CardapioHighlightSection[]
> {
  const rows = await prismaClient.cardapioHighlightSection.findMany({
    where: {
      published: true,
      deletedAt: null,
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 5,
  });

  return rows
    .map((row) => ({
      id: row.id,
      key: row.key,
      title: row.title,
      subtitle: row.subtitle,
      displayStyle: (row.displayStyle === "default"
        ? "default"
        : "polaroid") as CardapioHighlightDisplayStyle,
      showTitle: row.showTitle,
      images: parseImageItems(row.imageItemsJson),
    }))
    .filter((section) => section.images.length > 0);
}
