import { ValidationError } from "~/domain/z-api/errors";
import prismaClient from "~/lib/prisma/client.server";
import {
  CONTENT_POST_CHANNELS,
  CONTENT_POST_STATUSES,
  type ContentPostChannel,
  type ContentPostStatus,
} from "./content-post.shared";
import type { ContentPostMediaInput } from "./content-post-media.shared";

const SOCIAL_SOURCE_TYPE = "content-post-target";
const EXTERNAL_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function assertStatus(value: unknown): ContentPostStatus {
  if (value === CONTENT_POST_STATUSES.ACTIVE) return value;
  if (value === CONTENT_POST_STATUSES.ARCHIVED) return value;
  return CONTENT_POST_STATUSES.DRAFT;
}

export async function getContentPost(id: string) {
  const post = await prismaClient.contentPost.findUnique({
    where: { id },
    include: {
      Media: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      Targets: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { channel: "asc" }],
        include: {
          Executions: {
            orderBy: { startedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!post || post.deletedAt) {
    throw new ValidationError("Publicação não encontrada.", 404);
  }

  return post;
}

export async function listContentPosts(q = "") {
  const search = normalizeString(q);
  return prismaClient.contentPost.findMany({
    where: {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { subtitle: { contains: search, mode: "insensitive" } },
              { key: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: { select: { Media: true, Targets: true } },
      Targets: {
        where: { deletedAt: null },
        select: {
          id: true,
          channel: true,
          status: true,
          lastPublishedAt: true,
          removedAt: true,
          updatedAt: true,
        },
      },
    },
    take: 100,
  });
}

export async function createContentPost(input: {
  key: string;
  title: string;
  subtitle?: string;
  caption?: string;
  status?: string;
  media: ContentPostMediaInput[];
}) {
  const key = normalizeString(input.key);
  const title = normalizeString(input.title);
  const media = input.media.filter((item) => normalizeString(item.mediaUrl));
  if (!key || !title) {
    throw new ValidationError("Informe título e chave da publicação.");
  }

  return prismaClient.contentPost.create({
    data: {
      key,
      title,
      subtitle: normalizeString(input.subtitle) || null,
      caption: normalizeString(input.caption) || null,
      status: assertStatus(input.status),
      ...(media.length
        ? {
            Media: {
              create: media.map((item) => ({
                key: item.key,
                title: item.title,
                kind: item.kind,
                mediaUrl: item.mediaUrl,
                fullscreenMediaUrl: item.fullscreenMediaUrl || null,
                alt: item.alt || null,
                linkUrl: item.linkUrl || null,
                linkText: item.linkText || null,
                linkBackgroundColor: item.linkBackgroundColor || null,
                linkTextColor: item.linkTextColor || null,
                linkPosition: item.linkPosition || null,
                linkNewTab: item.linkNewTab ?? true,
                sortOrder: item.sortOrder,
              })),
            },
          }
        : {}),
      Targets: {
        create: [
          {
            channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
            status: "draft",
          },
          {
            channel: CONTENT_POST_CHANNELS.WHATSAPP_STATUS,
            status: "draft",
            sortOrder: 1,
          },
          {
            channel: CONTENT_POST_CHANNELS.INSTAGRAM_STORY,
            status: "draft",
            sortOrder: 2,
          },
        ],
      },
    },
    select: { id: true },
  });
}

async function buildUniqueCopyKey(baseKey: string) {
  const normalizedBase = normalizeString(baseKey) || "publicacao";
  const copyBase = `${normalizedBase}-copia`;

  for (let attempt = 0; attempt < 100; attempt++) {
    const key = attempt === 0 ? copyBase : `${copyBase}-${attempt + 1}`;
    const existing = await prismaClient.contentPost.findUnique({
      where: { key },
      select: { id: true },
    });
    if (!existing) return key;
  }

  return `${copyBase}-${Date.now()}`;
}

export async function duplicateContentPost(id: string) {
  const source = await getContentPost(id);
  const copiedTitle = `${source.title} Copia`;
  const copiedKey = await buildUniqueCopyKey(source.key);

  return prismaClient.$transaction(async (tx) => {
    const duplicated = await tx.contentPost.create({
      data: {
        key: copiedKey,
        title: copiedTitle,
        subtitle: source.subtitle,
        caption: source.caption,
        status: CONTENT_POST_STATUSES.DRAFT,
      },
      select: { id: true },
    });

    const mediaIdMap = new Map<string, string>();
    for (const media of source.Media) {
      const duplicatedMedia = await tx.contentPostMedia.create({
        data: {
          contentPostId: duplicated.id,
          key: media.key,
          title: media.title,
          kind: media.kind,
          mediaUrl: media.mediaUrl,
          fullscreenMediaUrl: media.fullscreenMediaUrl,
          alt: media.alt,
          linkUrl: media.linkUrl,
          linkText: media.linkText,
          linkBackgroundColor: media.linkBackgroundColor,
          linkTextColor: media.linkTextColor,
          linkPosition: media.linkPosition,
          linkNewTab: media.linkNewTab,
          sortOrder: media.sortOrder,
          active: media.active,
        },
        select: { id: true },
      });
      mediaIdMap.set(media.id, duplicatedMedia.id);
    }

    const targetIdMap = new Map<string, string>();
    for (const target of source.Targets) {
      const duplicatedTarget = await tx.contentPublicationTarget.create({
        data: {
          contentPostId: duplicated.id,
          channel: target.channel,
          status: "draft",
          sortOrder: target.sortOrder,
          config: target.config as any,
          lastPublishedAt: null,
          removalRequestedAt: null,
          removedAt: null,
          lastError: null,
        },
        select: { id: true },
      });
      targetIdMap.set(target.id, duplicatedTarget.id);
    }

    for (const [sourceTargetId, duplicatedTargetId] of targetIdMap) {
      const source = contentPostSocialSource(sourceTargetId);
      const duplicatedSource = contentPostSocialSource(duplicatedTargetId);

      const whatsappPublications = await tx.whatsappStatusPublication.findMany({
        where: { ...source, deletedAt: null },
      });
      for (const publication of whatsappPublications) {
        await tx.whatsappStatusPublication.create({
          data: {
            sourceType: duplicatedSource.sourceType,
            sourceId: duplicatedSource.sourceId,
            sourceItemKey:
              mediaIdMap.get(publication.sourceItemKey || "") ||
              publication.sourceItemKey,
            title: publication.title,
            kind: publication.kind,
            message: publication.message,
            imageUrl: publication.imageUrl,
            videoUrl: publication.videoUrl,
            caption: publication.caption,
            active: publication.active,
            deactivatedAt: publication.active ? null : new Date(),
            lastPublishedAt: null,
            lastPublishStatus: null,
            lastPublishResponse: undefined,
            lastPublishError: null,
            deletedAt: null,
          },
        });
      }

      const instagramPublications = await tx.instagramStoryPublication.findMany(
        {
          where: { ...source, deletedAt: null },
        }
      );
      for (const publication of instagramPublications) {
        await tx.instagramStoryPublication.create({
          data: {
            sourceType: duplicatedSource.sourceType,
            sourceId: duplicatedSource.sourceId,
            sourceItemKey:
              mediaIdMap.get(publication.sourceItemKey || "") ||
              publication.sourceItemKey,
            title: publication.title,
            kind: publication.kind,
            mediaUrl: publication.mediaUrl,
            active: publication.active,
            deactivatedAt: publication.active ? null : new Date(),
            lastContainerId: null,
            lastInstagramMediaId: null,
            lastPublishedAt: null,
            lastPublishStatus: null,
            lastPublishResponse: undefined,
            lastPublishError: null,
            deletedAt: null,
          },
        });
      }
    }

    return duplicated;
  });
}

export async function updateContentPostDetails(
  id: string,
  input: {
    key: string;
    title: string;
    subtitle?: string;
    caption?: string;
  }
) {
  const key = normalizeString(input.key);
  const title = normalizeString(input.title);
  if (!key || !title) {
    throw new ValidationError("Informe título e chave da publicação.");
  }

  return prismaClient.contentPost.update({
    where: { id },
    data: {
      key,
      title,
      subtitle: normalizeString(input.subtitle) || null,
      caption: normalizeString(input.caption) || null,
    },
  });
}

export async function replaceContentPostMedia(
  id: string,
  media: ContentPostMediaInput[]
) {
  const normalized = media.filter((item) => normalizeString(item.mediaUrl));
  if (!normalized.length) {
    throw new ValidationError("Informe pelo menos uma mídia.");
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.contentPostMedia.deleteMany({ where: { contentPostId: id } });
    await tx.contentPostMedia.createMany({
      data: normalized.map((item) => ({
        contentPostId: id,
        key: item.key,
        title: item.title,
        kind: item.kind,
        mediaUrl: item.mediaUrl,
        fullscreenMediaUrl: item.fullscreenMediaUrl || null,
        alt: item.alt || null,
        linkUrl: item.linkUrl || null,
        linkText: item.linkText || null,
        linkMenuItemId: item.linkMenuItemId || null,
        linkBackgroundColor: item.linkBackgroundColor || null,
        linkTextColor: item.linkTextColor || null,
        linkPosition: item.linkPosition || null,
        linkNewTab: item.linkNewTab ?? true,
        sortOrder: item.sortOrder,
      })),
    });

    const socialTargets = await tx.contentPublicationTarget.findMany({
      where: {
        contentPostId: id,
        channel: {
          in: [
            CONTENT_POST_CHANNELS.WHATSAPP_STATUS,
            CONTENT_POST_CHANNELS.INSTAGRAM_STORY,
          ],
        },
        deletedAt: null,
      },
      select: { id: true, channel: true },
    });

    await tx.contentPublicationTarget.updateMany({
      where: { id: { in: socialTargets.map((target) => target.id) } },
      data: { status: "needs_sync" },
    });

    const whatsappTargetIds = socialTargets
      .filter(
        (target) => target.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS
      )
      .map((target) => target.id);
    if (whatsappTargetIds.length) {
      await tx.whatsappStatusPublication.updateMany({
        where: {
          sourceType: SOCIAL_SOURCE_TYPE,
          sourceId: { in: whatsappTargetIds },
          deletedAt: null,
        },
        data: { active: false, deactivatedAt: new Date() },
      });
    }

    const instagramTargetIds = socialTargets
      .filter(
        (target) => target.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY
      )
      .map((target) => target.id);
    if (instagramTargetIds.length) {
      await tx.instagramStoryPublication.updateMany({
        where: {
          sourceType: SOCIAL_SOURCE_TYPE,
          sourceId: { in: instagramTargetIds },
          deletedAt: null,
        },
        data: { active: false, deactivatedAt: new Date() },
      });
    }
  });
}

export async function ensureContentPostTarget(
  contentPostId: string,
  channel: ContentPostChannel
) {
  return prismaClient.contentPublicationTarget.upsert({
    where: { contentPostId_channel: { contentPostId, channel } },
    create: { contentPostId, channel },
    update: { deletedAt: null },
  });
}

export async function updateContentPostTarget(params: {
  contentPostId: string;
  channel: ContentPostChannel;
  sortOrder?: number;
  config?: unknown;
}) {
  const post = await getContentPost(params.contentPostId);
  const active = post.status === CONTENT_POST_STATUSES.ACTIVE;
  const previous = post.Targets.find(
    (target) => target.channel === params.channel
  );
  const hasPublishedState =
    previous?.status === "active" && Boolean(previous.lastPublishedAt);
  const targetStatus = active
    ? hasPublishedState
      ? "active"
      : "needs_sync"
    : "draft";
  const publishedAt = hasPublishedState ? previous?.lastPublishedAt : null;

  return prismaClient.contentPublicationTarget.upsert({
    where: {
      contentPostId_channel: {
        contentPostId: params.contentPostId,
        channel: params.channel,
      },
    },
    create: {
      contentPostId: params.contentPostId,
      channel: params.channel,
      status: targetStatus,
      sortOrder: params.sortOrder ?? 0,
      config: params.config as any,
      lastPublishedAt: publishedAt,
    },
    update: {
      status: targetStatus,
      sortOrder: params.sortOrder ?? 0,
      config: params.config as any,
      lastPublishedAt: publishedAt,
      removalRequestedAt: null,
      removedAt: null,
      lastError: null,
      deletedAt: null,
    },
  });
}

export async function unpublishContentTarget(targetId: string) {
  await requestContentTargetRemoval(targetId);
}

export async function setContentPostStatus(id: string, statusValue: unknown) {
  const status = assertStatus(statusValue);
  const existing = await getContentPost(id);
  if (existing.status === status) return;
  const now = new Date();

  await prismaClient.contentPost.update({
    where: { id },
    data: {
      status,
      archivedAt: status === CONTENT_POST_STATUSES.ARCHIVED ? now : null,
    },
  });

  if (status === CONTENT_POST_STATUSES.ACTIVE) {
    for (const target of existing.Targets) {
      const targetStatus =
        target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
          ? target.status === "active" && target.lastPublishedAt
            ? "active"
            : "needs_sync"
          : "needs_sync";

      await prismaClient.contentPublicationTarget.update({
        where: { id: target.id },
        data: {
          status: targetStatus,
          lastPublishedAt:
            target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED &&
            targetStatus !== "active"
              ? null
              : target.lastPublishedAt,
          removalRequestedAt: null,
          removedAt: null,
        },
      });
    }
    return;
  }

  for (const target of existing.Targets) {
    await requestContentTargetRemoval(target.id);
  }
}

async function requestContentTargetRemoval(targetId: string) {
  const target = await prismaClient.contentPublicationTarget.findUnique({
    where: { id: targetId },
  });
  if (!target || target.deletedAt) return;

  const now = new Date();
  const lastPublishedAt = target.lastPublishedAt?.getTime() || 0;
  const stillExternallyVisible =
    target.channel !== CONTENT_POST_CHANNELS.CARDAPIO_FEATURED &&
    lastPublishedAt > 0 &&
    now.getTime() - lastPublishedAt < EXTERNAL_TTL_MS;

  await prismaClient.$transaction(async (tx) => {
    await tx.contentPublicationTarget.update({
      where: { id: target.id },
      data: {
        status: stillExternallyVisible ? "removal_pending" : "removed",
        removalRequestedAt: now,
        removedAt: stillExternallyVisible ? null : now,
      },
    });

    await tx.contentPublicationExecution.create({
      data: {
        targetId: target.id,
        operation: "remove",
        source: "content-post-lifecycle",
        status: stillExternallyVisible ? "pending_expiration" : "success",
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        response: stillExternallyVisible
          ? {
              reason:
                "A plataforma não oferece remoção confiável; aguardando expiração de 24 horas.",
            }
          : undefined,
      },
    });

    if (target.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS) {
      await tx.whatsappStatusPublication.updateMany({
        where: {
          sourceType: SOCIAL_SOURCE_TYPE,
          sourceId: target.id,
          deletedAt: null,
        },
        data: { active: false, deactivatedAt: now },
      });
    }

    if (target.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY) {
      await tx.instagramStoryPublication.updateMany({
        where: {
          sourceType: SOCIAL_SOURCE_TYPE,
          sourceId: target.id,
          deletedAt: null,
        },
        data: { active: false, deactivatedAt: now },
      });
    }
  });
}

export async function softDeleteContentPost(id: string) {
  await setContentPostStatus(id, CONTENT_POST_STATUSES.ARCHIVED);
  await prismaClient.contentPost.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export const contentPostSocialSource = (targetId: string) => ({
  sourceType: SOCIAL_SOURCE_TYPE,
  sourceId: targetId,
});

export async function markContentTargetSynced(targetId: string) {
  const target = await prismaClient.contentPublicationTarget.findUnique({
    where: { id: targetId },
    include: { ContentPost: { select: { status: true } } },
  });
  if (!target) return;

  const activeContent =
    target.ContentPost.status === CONTENT_POST_STATUSES.ACTIVE;
  const configuredStatus = activeContent
    ? target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
      ? target.status === "active" && target.lastPublishedAt
        ? "active"
        : "needs_sync"
      : "needs_sync"
    : "draft";

  await prismaClient.contentPublicationTarget.update({
    where: { id: targetId },
    data: {
      status: configuredStatus,
      lastPublishedAt:
        target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED &&
        configuredStatus === "active"
          ? target.lastPublishedAt
          : null,
      removalRequestedAt: null,
      removedAt: null,
      lastError: null,
    },
  });
}

export async function runContentTargetOperation<T>(params: {
  targetId: string;
  operation: "publish" | "update" | "remove";
  source?: string;
  execute: () => Promise<T>;
  externalId?: (result: T) => string | null | undefined;
  response?: (result: T) => unknown;
}) {
  const startedAt = new Date();
  const execution = await prismaClient.contentPublicationExecution.create({
    data: {
      targetId: params.targetId,
      operation: params.operation,
      source: normalizeString(params.source) || "manual",
      status: "running",
      startedAt,
    },
  });

  try {
    const result = await params.execute();
    const finishedAt = new Date();
    await prismaClient.$transaction([
      prismaClient.contentPublicationExecution.update({
        where: { id: execution.id },
        data: {
          status: "success",
          externalId: params.externalId?.(result) || null,
          response: (params.response?.(result) as any) ?? undefined,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      }),
      prismaClient.contentPublicationTarget.update({
        where: { id: params.targetId },
        data: {
          status: "active",
          lastPublishedAt: finishedAt,
          removalRequestedAt: null,
          removedAt: null,
          lastError: null,
        },
      }),
    ]);
    return result;
  } catch (error: any) {
    const finishedAt = new Date();
    const message = error?.message || "Erro na publicação.";
    await prismaClient.$transaction([
      prismaClient.contentPublicationExecution.update({
        where: { id: execution.id },
        data: {
          status: "error",
          error: message,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      }),
      prismaClient.contentPublicationTarget.update({
        where: { id: params.targetId },
        data: { status: "failed", lastError: message },
      }),
    ]);
    throw error;
  }
}
