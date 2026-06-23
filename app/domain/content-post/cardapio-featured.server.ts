import prismaClient from "~/lib/prisma/client.server";
import {
  CONTENT_POST_CHANNELS,
  parseCardapioFeaturedConfig,
} from "./content-post.shared";

export type CardapioFeaturedMedia = {
  id: string;
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
};

export type CardapioFeatured = {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  displayStyle: "polaroid" | "default";
  showTitle: boolean;
  showPromotionHint: boolean;
  images: CardapioFeaturedMedia[];
};

export async function findPublishedCardapioFeatured(): Promise<
  CardapioFeatured[]
> {
  const now = new Date();
  const targets = await prismaClient.contentPublicationTarget.findMany({
    where: {
      channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
      enabled: true,
      status: "active",
      deletedAt: null,
      ContentPost: {
        status: "active",
        deletedAt: null,
        AND: [
          {
            OR: [{ publishFrom: null }, { publishFrom: { lte: now } }],
          },
          {
            OR: [{ publishUntil: null }, { publishUntil: { gt: now } }],
          },
        ],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: {
      ContentPost: {
        include: {
          Media: {
            where: { active: true, deletedAt: null, kind: "image" },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
    take: 5,
  });

  return targets
    .map((target) => {
      const config = parseCardapioFeaturedConfig(target.config);
      return {
        id: target.id,
        key: target.ContentPost.key,
        title: target.ContentPost.title,
        subtitle: target.ContentPost.subtitle,
        ...config,
        images: target.ContentPost.Media.map((media) => ({
          id: media.id,
          imageUrl: media.mediaUrl,
          fullscreenImageUrl: media.fullscreenMediaUrl || media.mediaUrl,
          alt: media.alt,
          linkUrl: media.linkUrl,
          linkText: media.linkText,
          linkBackgroundColor: media.linkBackgroundColor,
          linkTextColor: media.linkTextColor,
        })),
      };
    })
    .filter((featured) => featured.images.length > 0);
}
