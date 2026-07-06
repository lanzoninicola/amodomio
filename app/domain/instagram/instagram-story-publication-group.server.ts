import {
  publishInstagramStory,
  type InstagramStoryExecutionInput,
  type InstagramStoryKind,
} from "~/domain/instagram/instagram-story-publication.server";
import {
  getInstagramStoryLifecycleStatus,
  getInstagramStoryStatusWindow,
} from "~/domain/instagram/instagram-story-publication.shared";
import { ValidationError } from "~/domain/z-api/errors";
import prismaClient from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";

export type InstagramStorySource = {
  sourceType: string;
  sourceId: string;
};

export type InstagramStorySourceItem = {
  key: string;
  title: string;
  kind: InstagramStoryKind;
  mediaUrl: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSource(source: InstagramStorySource) {
  const sourceType = normalizeString(source.sourceType);
  const sourceId = normalizeString(source.sourceId);
  if (!sourceType || !sourceId) {
    throw new ValidationError("Origem da publicação do Instagram inválida.");
  }
  return { sourceType, sourceId };
}

function normalizeItems(items: InstagramStorySourceItem[]) {
  const unique = new Map<string, InstagramStorySourceItem>();
  for (const item of items) {
    const key = normalizeString(item.key);
    const title = normalizeString(item.title);
    const mediaUrl = normalizeString(item.mediaUrl);
    if (!key || !title || !mediaUrl) continue;
    unique.set(key, {
      key,
      title,
      mediaUrl,
      kind: item.kind === "video" ? "video" : "image",
    });
  }
  return Array.from(unique.values());
}

export async function getInstagramStoryGroup(source: InstagramStorySource) {
  const normalizedSource = normalizeSource(source);
  const publications = await prismaClient.instagramStoryPublication.findMany({
    where: { ...normalizedSource, deletedAt: null },
    orderBy: { sourceItemKey: "asc" },
    include: {
      Executions: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  return {
    publications: publications.map((publication) => ({
      ...publication,
      lifecycleStatus: getInstagramStoryLifecycleStatus(publication),
      statusWindow: getInstagramStoryStatusWindow(publication),
    })),
    selectedKeys: publications
      .filter((publication) => publication.active)
      .map((publication) => publication.sourceItemKey)
      .filter((key): key is string => Boolean(key)),
  };
}

export async function syncInstagramStoryGroup(params: {
  source: InstagramStorySource;
  items: InstagramStorySourceItem[];
  selectedKeys: string[];
}) {
  const source = normalizeSource(params.source);
  const items = normalizeItems(params.items);
  const itemsByKey = new Map(items.map((item) => [item.key, item]));
  const selectedKeys = Array.from(
    new Set(
      params.selectedKeys
        .map(normalizeString)
        .filter((key) => itemsByKey.has(key))
    )
  );

  await prismaClient.$transaction(async (tx) => {
    await tx.instagramStoryPublication.updateMany({
      where: { ...source, deletedAt: null },
      data: { active: false, deactivatedAt: new Date() },
    });

    for (const key of selectedKeys) {
      const item = itemsByKey.get(key);
      if (!item) continue;

      await tx.instagramStoryPublication.upsert({
        where: {
          sourceType_sourceId_sourceItemKey: {
            ...source,
            sourceItemKey: key,
          },
        },
        create: {
          ...source,
          sourceItemKey: key,
          title: item.title,
          kind: item.kind,
          mediaUrl: item.mediaUrl,
          active: true,
        },
        update: {
          title: item.title,
          kind: item.kind,
          mediaUrl: item.mediaUrl,
          active: true,
          deactivatedAt: null,
          deletedAt: null,
        },
      });
    }
  });

  return getInstagramStoryGroup(source);
}

export async function clearInstagramStoryGroupPublishState(
  source: InstagramStorySource
) {
  const normalizedSource = normalizeSource(source);
  await prismaClient.instagramStoryPublication.updateMany({
    where: { ...normalizedSource, deletedAt: null },
    data: {
      lastPublishedAt: null,
      lastPublishStatus: null,
      lastPublishResponse: Prisma.DbNull,
      lastPublishError: null,
    },
  });
}

export async function publishInstagramStoryGroup(
  source: InstagramStorySource,
  executionInput?: InstagramStoryExecutionInput
) {
  const normalizedSource = normalizeSource(source);
  const publications = await prismaClient.instagramStoryPublication.findMany({
    where: { ...normalizedSource, active: true, deletedAt: null },
    orderBy: { sourceItemKey: "asc" },
  });
  if (!publications.length) {
    throw new ValidationError(
      "Selecione e salve pelo menos uma mídia para o Instagram.",
      409
    );
  }

  const results = [];
  for (const publication of publications) {
    results.push(await publishInstagramStory(publication.id, executionInput));
  }

  return { source: normalizedSource, publications: results };
}
