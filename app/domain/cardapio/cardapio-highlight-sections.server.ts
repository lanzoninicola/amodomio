import prismaClient from "~/lib/prisma/client.server";

export type CardapioHighlightImage = {
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
};

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

      return {
        imageUrl,
        fullscreenImageUrl: fullscreenImageUrl || null,
        alt: alt || null,
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
      displayStyle: (row.displayStyle === "default" ? "default" : "polaroid") as CardapioHighlightDisplayStyle,
      showTitle: row.showTitle,
      images: parseImageItems(row.imageItemsJson),
    }))
    .filter((section) => section.images.length > 0);
}
