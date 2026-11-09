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
  promotionHintText?: string | null;
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
        .flatMap((target) => {
          const config = parseCardapioFeaturedConfig(target.config);
          return [
            ...target.ContentPost.Media.map((media) => media.linkMenuItemId),
            ...Object.values(config.mediaConfigByKey).map(
              (media) => media.linkMenuItemId
            ),
          ];
        })
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
      const selectedMediaKeys = config.selectedMediaKeys
        ? new Set(config.selectedMediaKeys)
        : null;
      const selectedMedia = selectedMediaKeys
        ? target.ContentPost.Media.filter((media) =>
            selectedMediaKeys.has(media.key)
          )
        : target.ContentPost.Media;
      return {
        id: target.id,
        key: target.ContentPost.key,
        title: target.ContentPost.title,
        subtitle: target.ContentPost.subtitle,
        displayStyle: config.displayStyle,
        showTitle: config.showTitle,
        showPromotionHint: config.showPromotionHint,
        promotionHintText: config.promotionHintText,
        images: selectedMedia.map((media) => {
          const channelMedia = config.mediaConfigByKey[media.key];
          const linkMenuItemId =
            channelMedia?.linkMenuItemId ??
            (channelMedia ? null : media.linkMenuItemId);
          const linkedSlug = linkMenuItemId
            ? slugByMenuItemId.get(linkMenuItemId)
            : null;

          return {
            id: media.id,
            kind: media.kind,
            imageUrl: media.mediaUrl,
            fullscreenImageUrl: media.fullscreenMediaUrl || media.mediaUrl,
            alt: media.alt,
            linkUrl: linkedSlug
              ? getCardapioItemAnchorHref({ slug: linkedSlug })
              : channelMedia
              ? channelMedia.linkUrl
              : media.linkUrl,
            linkText: channelMedia ? channelMedia.linkText : media.linkText,
            linkBackgroundColor:
              channelMedia?.linkBackgroundColor ??
              (channelMedia ? null : media.linkBackgroundColor),
            linkTextColor:
              channelMedia?.linkTextColor ??
              (channelMedia ? null : media.linkTextColor),
            linkPosition: channelMedia
              ? channelMedia.linkPosition
              : media.linkPosition,
            linkNewTab: channelMedia
              ? channelMedia.linkNewTab
              : media.linkNewTab,
            chipAction: channelMedia
              ? channelMedia.chipAction
              : media.chipAction,
            chipModalTitle:
              channelMedia?.chipModalTitle ??
              (channelMedia ? null : media.chipModalTitle),
            chipModalBody:
              channelMedia?.chipModalBody ??
              (channelMedia ? null : media.chipModalBody),
          };
        }),
      };
    })
    .filter((featured) => featured.images.length > 0);
}
