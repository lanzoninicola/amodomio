import type { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import {
  invalidateCardapioIndexCache,
  invalidateSellingPriceHandlerCache,
} from "~/domain/cardapio/cardapio-cache.server";

export type ProductLineInput = {
  name: string;
  key: string;
  description: string | null;
  sortOrderIndex: number;
  active: boolean;
  visibleChannelIds: string[];
};

export function normalizeProductLineKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listProductLinesForManagement() {
  const [productLines, sellingChannels] = await Promise.all([
    prismaClient.productLine.findMany({
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      include: {
        ProductLineSellingChannel: true,
        _count: { select: { ItemGroup: true } },
      },
    }),
    prismaClient.itemSellingChannel.findMany({
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      select: { id: true, key: true, name: true },
    }),
  ]);

  return { productLines, sellingChannels };
}

async function syncProductLineChannels(
  tx: Prisma.TransactionClient,
  productLineId: string,
  channelIds: string[],
  visibleChannelIds: string[]
) {
  const visibleIds = new Set(visibleChannelIds);

  await Promise.all(
    channelIds.map((itemSellingChannelId) =>
      tx.productLineSellingChannel.upsert({
        where: {
          productLineId_itemSellingChannelId: {
            productLineId,
            itemSellingChannelId,
          },
        },
        create: {
          productLineId,
          itemSellingChannelId,
          visible: visibleIds.has(itemSellingChannelId),
        },
        update: {
          visible: visibleIds.has(itemSellingChannelId),
        },
      })
    )
  );
}

async function invalidateProductLineCaches() {
  await Promise.all([
    invalidateCardapioIndexCache(),
    invalidateSellingPriceHandlerCache(),
  ]);
}

export async function createProductLine(input: ProductLineInput) {
  const channelIds = (
    await prismaClient.itemSellingChannel.findMany({ select: { id: true } })
  ).map((channel) => channel.id);

  const productLine = await prismaClient.$transaction(async (tx) => {
    const created = await tx.productLine.create({
      data: {
        name: input.name,
        key: input.key,
        description: input.description,
        sortOrderIndex: input.sortOrderIndex,
        active: input.active,
      },
    });

    await syncProductLineChannels(
      tx,
      created.id,
      channelIds,
      input.visibleChannelIds
    );

    return created;
  });

  await invalidateProductLineCaches();
  return productLine;
}

export async function updateProductLine(
  productLineId: string,
  input: ProductLineInput
) {
  const channelIds = (
    await prismaClient.itemSellingChannel.findMany({ select: { id: true } })
  ).map((channel) => channel.id);

  const productLine = await prismaClient.$transaction(async (tx) => {
    const updated = await tx.productLine.update({
      where: { id: productLineId },
      data: {
        name: input.name,
        key: input.key,
        description: input.description,
        sortOrderIndex: input.sortOrderIndex,
        active: input.active,
      },
    });

    await syncProductLineChannels(
      tx,
      productLineId,
      channelIds,
      input.visibleChannelIds
    );

    return updated;
  });

  await invalidateProductLineCaches();
  return productLine;
}

export async function deleteProductLine(productLineId: string) {
  const groupCount = await prismaClient.itemGroup.count({
    where: { productLineId },
  });

  if (groupCount > 0) {
    return { deleted: false as const, groupCount };
  }

  await prismaClient.productLine.delete({ where: { id: productLineId } });
  await invalidateProductLineCaches();

  return { deleted: true as const, groupCount: 0 };
}
