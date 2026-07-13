import prismaClient from "~/lib/prisma/client.server";
import { getCardapioItemAnchorHref } from "~/domain/cardapio/cardapio-index.shared";
import {
  CONTENT_POST_CHANNELS,
  parseCardapioFeaturedConfig,
} from "./content-post.shared";

export type CardapioFeaturedMedia = {
  id: string;
  kind?: string | null;
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
  linkPosition?: string | null;
  linkNewTab?: boolean;
  chipAction?: string | null;
  chipModalTitle?: string | null;
  chipModalBody?: string | null;
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
      status: "active",
      lastPublishedAt: { not: null },
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
            where: {
              active: true,
              deletedAt: null,
              kind: { in: ["image", "video"] },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
    take: 5,
  });

  const linkMenuItemIds = Array.from(
    new Set(
      targets
        .flatMap((target) => target.ContentPost.Media)
        .map((media) => media.linkMenuItemId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const linkMenuItems = linkMenuItemIds.length
    ? await prismaClient.item.findMany({
        where: { id: { in: linkMenuItemIds } },
        select: { id: true, ItemSellingInfo: { select: { slug: true } } },
      })
    : [];
  const slugByMenuItemId = new Map(
    linkMenuItems
      .filter((item) => item.ItemSellingInfo?.slug)
      .map((item) => [item.id, item.ItemSellingInfo!.slug as string])
  );

  return targets
    .map((target) => {
      const config = parseCardapioFeaturedConfig(target.config);
      return {
        id: target.id,
        key: target.ContentPost.key,
        title: target.ContentPost.title,
        subtitle: target.ContentPost.subtitle,
        ...config,
        images: target.ContentPost.Media.map((media) => {
          const linkedSlug = media.linkMenuItemId
            ? slugByMenuItemId.get(media.linkMenuItemId)
            : null;

          return {
            id: media.id,
            kind: media.kind,
            imageUrl: media.mediaUrl,
            fullscreenImageUrl: media.fullscreenMediaUrl || media.mediaUrl,
            alt: media.alt,
            linkUrl: linkedSlug
              ? getCardapioItemAnchorHref({ slug: linkedSlug })
              : media.linkUrl,
            linkText: media.linkText,
            linkBackgroundColor: media.linkBackgroundColor,
            linkTextColor: media.linkTextColor,
            linkPosition: media.linkPosition,
            linkNewTab: media.linkNewTab,
            chipAction: media.chipAction,
            chipModalTitle: media.chipModalTitle,
            chipModalBody: media.chipModalBody,
          };
        }),
      };
    })
    .filter((featured) => featured.images.length > 0);
}
