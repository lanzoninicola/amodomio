import { ValidationError } from "~/domain/z-api/errors";
import {
  publishStatusPublication,
  type StatusPublicationExecutionInput,
} from "~/domain/whatsapp-status/whatsapp-status-publication.server";
import {
  getPublicationLifecycleStatus,
  getPublicationStatusWindow,
  type StatusPublicationKind,
} from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import prismaClient from "~/lib/prisma/client.server";

export type StatusPublicationSource = {
  sourceType: string;
  sourceId: string;
};

export type StatusPublicationSourceItem = {
  key: string;
  title: string;
  kind: StatusPublicationKind;
  message?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSource(source: StatusPublicationSource) {
  const sourceType = normalizeString(source.sourceType);
  const sourceId = normalizeString(source.sourceId);

  if (!sourceType || !sourceId) {
    throw new ValidationError("Origem da publicação inválida.");
  }

  return { sourceType, sourceId };
}

function normalizeItems(items: StatusPublicationSourceItem[]) {
  const unique = new Map<string, StatusPublicationSourceItem>();

  for (const item of items) {
    const key = normalizeString(item.key);
    const title = normalizeString(item.title);
    if (!key || !title) continue;

    unique.set(key, {
      key,
      title,
      kind: item.kind,
      message: normalizeString(item.message) || null,
      imageUrl: normalizeString(item.imageUrl) || null,
      videoUrl: normalizeString(item.videoUrl) || null,
    });
  }

  return Array.from(unique.values());
}

export async function getStatusPublicationGroup(
  source: StatusPublicationSource
) {
  const normalizedSource = normalizeSource(source);
  const publications = await prismaClient.whatsappStatusPublication.findMany({
    where: {
      ...normalizedSource,
      deletedAt: null,
    },
    orderBy: { sourceItemKey: "asc" },
    include: {
      Executions: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  return {
    caption:
      publications.find((publication) => publication.caption)?.caption || "",
    publications: publications.map((publication) => ({
      ...publication,
      lifecycleStatus: getPublicationLifecycleStatus(publication),
      statusWindow: getPublicationStatusWindow(publication),
    })),
    selectedKeys: publications
      .filter((publication) => publication.active)
      .map((publication) => publication.sourceItemKey)
      .filter((key): key is string => Boolean(key)),
  };
}

export async function syncStatusPublicationGroup(params: {
  source: StatusPublicationSource;
  items: StatusPublicationSourceItem[];
  selectedKeys: string[];
  caption?: string;
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
  const caption = normalizeString(params.caption);

  await prismaClient.$transaction(async (tx) => {
    await tx.whatsappStatusPublication.updateMany({
      where: {
        ...source,
        deletedAt: null,
      },
      data: {
        active: false,
        deactivatedAt: new Date(),
      },
    });

    for (const key of selectedKeys) {
      const item = itemsByKey.get(key);
      if (!item) continue;

      await tx.whatsappStatusPublication.upsert({
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
          message: item.kind === "text" ? item.message : null,
          imageUrl: item.kind === "image" ? item.imageUrl : null,
          videoUrl: item.kind === "video" ? item.videoUrl : null,
          caption: item.kind === "text" ? null : caption || null,
          active: true,
        },
        update: {
          title: item.title,
          kind: item.kind,
          message: item.kind === "text" ? item.message : null,
          imageUrl: item.kind === "image" ? item.imageUrl : null,
          videoUrl: item.kind === "video" ? item.videoUrl : null,
          caption: item.kind === "text" ? null : caption || null,
          active: true,
          deactivatedAt: null,
          deletedAt: null,
        },
      });
    }
  });

  return getStatusPublicationGroup(source);
}

export async function publishStatusPublicationGroup(
  source: StatusPublicationSource,
  executionInput?: StatusPublicationExecutionInput
) {
  const normalizedSource = normalizeSource(source);
  const publications = await prismaClient.whatsappStatusPublication.findMany({
    where: {
      ...normalizedSource,
      active: true,
      deletedAt: null,
    },
    orderBy: { sourceItemKey: "asc" },
  });

  if (!publications.length) {
    throw new ValidationError(
      "Selecione e salve pelo menos uma publicação.",
      409
    );
  }

  const results = [];
  for (const publication of publications) {
    results.push(
      await publishStatusPublication(publication.id, executionInput)
    );
  }

  return {
    source: normalizedSource,
    publications: results,
  };
}
