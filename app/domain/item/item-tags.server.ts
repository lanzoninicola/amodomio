import { Prisma, Tag } from "@prisma/client";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

type ItemTagRecord = {
  id: string;
  Tag: Tag;
};

export async function listItemTags(itemId: string): Promise<ItemTagRecord[]> {
  const db = prismaClient as any;
  return await db.itemTag.findMany({
    where: {
      itemId,
      deletedAt: null,
    },
    include: {
      Tag: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function associateItemTag(itemId: string, tagId: string) {
  const db = prismaClient as any;

  const existing = await db.itemTag.findFirst({
    where: {
      itemId,
      tagId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) return existing;

  const created = await db.itemTag.create({
    data: {
      itemId,
      tagId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Prisma.ItemTagUncheckedCreateInput,
    select: { id: true },
  });

  await invalidateCardapioIndexCache();
  return created;
}

export async function removeItemTag(itemId: string, tagId: string) {
  const db = prismaClient as any;
  const existing = await db.itemTag.findFirst({
    where: {
      itemId,
      tagId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!existing) return null;

  await db.itemTag.delete({
    where: { id: existing.id },
  });

  await invalidateCardapioIndexCache();
  return existing;
}
