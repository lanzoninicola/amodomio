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
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { Media: true, Targets: true } },
      Targets: {
        where: { deletedAt: null },
        select: { channel: true, enabled: true, status: true },
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
  if (!media.length) {
    throw new ValidationError("Informe pelo menos uma mídia.");
  }

  return prismaClient.contentPost.create({
    data: {
      key,
      title,
      subtitle: normalizeString(input.subtitle) || null,
      caption: normalizeString(input.caption) || null,
      status: assertStatus(input.status),
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
          sortOrder: item.sortOrder,
        })),
      },
      Targets: {
        create: [
          {
            channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
            enabled: false,
            status: "draft",
          },
          {
            channel: CONTENT_POST_CHANNELS.WHATSAPP_STATUS,
            enabled: false,
            status: "draft",
            sortOrder: 1,
          },
          {
            channel: CONTENT_POST_CHANNELS.INSTAGRAM_STORY,
            enabled: false,
            status: "draft",
            sortOrder: 2,
          },
        ],
      },
    },
    select: { id: true },
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
        linkBackgroundColor: item.linkBackgroundColor || null,
        linkTextColor: item.linkTextColor || null,
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
  enabled: boolean;
  sortOrder?: number;
  config?: unknown;
}) {
  const post = await getContentPost(params.contentPostId);
  const enabled = params.enabled;
  const active = enabled && post.status === CONTENT_POST_STATUSES.ACTIVE;
  const previous = post.Targets.find(
    (target) => target.channel === params.channel
  );
  const enabledStatus = active
    ? params.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
      ? "active"
      : previous?.status === "active"
      ? "active"
      : "needs_sync"
    : "draft";

  const target = await prismaClient.contentPublicationTarget.upsert({
    where: {
      contentPostId_channel: {
        contentPostId: params.contentPostId,
        channel: params.channel,
      },
    },
    create: {
      contentPostId: params.contentPostId,
      channel: params.channel,
      enabled,
      status: enabledStatus,
      sortOrder: params.sortOrder ?? 0,
      config: params.config as any,
    },
    update: {
      enabled,
      status: enabledStatus,
      sortOrder: params.sortOrder ?? 0,
      config: params.config as any,
      removalRequestedAt: null,
      removedAt: null,
      lastError: null,
      deletedAt: null,
    },
  });

  if (!enabled && previous?.enabled) {
    await requestContentTargetRemoval(target.id, false);
  }

  return target;
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
    for (const target of existing.Targets.filter((item) => item.enabled)) {
      await prismaClient.contentPublicationTarget.update({
        where: { id: target.id },
        data: {
          status:
            target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
              ? "active"
              : "needs_sync",
          removalRequestedAt: null,
          removedAt: null,
        },
      });
    }
    return;
  }

  for (const target of existing.Targets) {
    await requestContentTargetRemoval(target.id, true);
  }
}

async function requestContentTargetRemoval(
  targetId: string,
  preserveEnabled: boolean
) {
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
        enabled: preserveEnabled ? target.enabled : false,
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

  await prismaClient.contentPublicationTarget.update({
    where: { id: targetId },
    data: {
      status:
        target.enabled &&
        target.ContentPost.status === CONTENT_POST_STATUSES.ACTIVE
          ? "active"
          : "draft",
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
