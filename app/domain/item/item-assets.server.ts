import prismaClient from "~/lib/prisma/client.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

export type ItemAssetAdminDTO = {
  id: string;
  url: string;
  kind: "image" | "video";
  slot: string | null;
  visible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type ItemAssetsListDTO = {
  primary: ItemAssetAdminDTO | null;
  gallery: ItemAssetAdminDTO[];
  assets: ItemAssetAdminDTO[];
};

function toAssetDTO(asset: {
  id: string;
  secureUrl: string | null;
  kind: string;
  slot: string | null;
  visible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
}): ItemAssetAdminDTO {
  return {
    id: asset.id,
    url: asset.secureUrl || "",
    kind: asset.kind === "video" ? "video" : "image",
    slot: asset.slot,
    visible: asset.visible,
    isPrimary: asset.isPrimary,
    sortOrder: asset.sortOrder,
    createdAt: asset.createdAt,
  };
}

export async function listItemAssetsAdmin(itemId: string): Promise<ItemAssetsListDTO> {
  const db = prismaClient as any;
  const images = await db.itemGalleryImage.findMany({
    where: { itemId },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      secureUrl: true,
      kind: true,
      slot: true,
      visible: true,
      isPrimary: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  const mapped = images.map(toAssetDTO);
  const primary = mapped.find((image) => image.isPrimary) || null;
  const gallery = mapped
    .filter((image) => !image.isPrimary)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());

  return {
    primary,
    gallery,
    assets: mapped,
  };
}

type CreateItemAssetInput = {
  itemId: string;
  url: string;
  kind?: "image" | "video";
  visible?: boolean;
  isPrimary?: boolean;
  assetId?: string | null;
  mediaAssetId?: string | null;
  assetFolder?: string | null;
  originalFileName?: string | null;
  displayName?: string | null;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnailUrl?: string | null;
  publicId?: string | null;
};

export async function createItemAsset(input: CreateItemAssetInput) {
  const db = prismaClient as any;
  const created = await db.$transaction(async (tx: any) => {
    const imageCount = await tx.itemGalleryImage.count({
      where: { itemId: input.itemId },
    });

    const last = await tx.itemGalleryImage.findFirst({
      where: { itemId: input.itemId },
      orderBy: [{ sortOrder: "desc" }],
      select: { sortOrder: true },
    });

    const shouldSetPrimary = Boolean(input.isPrimary) || imageCount === 0;
    const nextSortOrder = Number(last?.sortOrder || 0) + 1;

    if (shouldSetPrimary) {
      await tx.itemGalleryImage.updateMany({
        where: { itemId: input.itemId },
        data: { isPrimary: false },
      });
    }

    return await tx.itemGalleryImage.create({
      data: {
        itemId: input.itemId,
        kind: input.kind === "video" ? "video" : "image",
        secureUrl: input.url,
        slot: shouldSetPrimary ? "cover" : "gallery",
        assetId: input.assetId ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        assetFolder: input.assetFolder ?? null,
        originalFileName: input.originalFileName ?? null,
        displayName: input.displayName ?? null,
        format: input.format ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        publicId: input.publicId ?? null,
        visible: input.visible ?? true,
        isPrimary: shouldSetPrimary,
        sortOrder: nextSortOrder,
      },
      select: {
        id: true,
        secureUrl: true,
        kind: true,
        slot: true,
        visible: true,
        isPrimary: true,
        sortOrder: true,
        createdAt: true,
      },
    });
  });

  await invalidateCardapioIndexCache();
  return toAssetDTO(created);
}

export async function setItemAssetPrimary(itemId: string, assetId: string) {
  const db = prismaClient as any;
  const updated = await db.$transaction(async (tx: any) => {
    const asset = await tx.itemGalleryImage.findFirst({
      where: { id: assetId, itemId },
      select: { id: true },
    });

    if (!asset) return null;

    await tx.itemGalleryImage.updateMany({
      where: { itemId },
      data: { isPrimary: false, slot: "gallery" },
    });

    return await tx.itemGalleryImage.update({
      where: { id: assetId },
      data: { isPrimary: true, visible: true, slot: "cover" },
      select: {
        id: true,
        secureUrl: true,
        kind: true,
        slot: true,
        visible: true,
        isPrimary: true,
        sortOrder: true,
        createdAt: true,
      },
    });
  });

  if (!updated) return null;

  await invalidateCardapioIndexCache();
  return toAssetDTO(updated);
}

export async function setItemAssetVisibility(itemId: string, assetId: string, visible: boolean) {
  const db = prismaClient as any;
  const asset = await db.itemGalleryImage.findFirst({
    where: { id: assetId, itemId },
    select: { id: true },
  });

  if (!asset) return null;

  const updated = await db.itemGalleryImage.update({
    where: { id: assetId },
    data: { visible },
    select: {
      id: true,
      secureUrl: true,
      kind: true,
      slot: true,
      visible: true,
      isPrimary: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  await invalidateCardapioIndexCache();
  return toAssetDTO(updated);
}

export async function reorderItemGalleryAssets(itemId: string, orderedIds: string[]) {
  const db = prismaClient as any;
  const gallery = await db.itemGalleryImage.findMany({
    where: { itemId, isPrimary: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const validIds = new Set(gallery.map((asset: { id: string }) => asset.id));
  const incoming = Array.from(new Set((orderedIds || []).filter((id) => validIds.has(id))));
  const missing = gallery.map((asset: { id: string }) => asset.id).filter((id: string) => !incoming.includes(id));
  const finalOrder = [...incoming, ...missing];

  await db.$transaction(
    finalOrder.map((id, index) =>
      db.itemGalleryImage.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  );

  await invalidateCardapioIndexCache();
}

export async function deleteItemAsset(itemId: string, assetId: string) {
  const db = prismaClient as any;
  const deleted = await db.$transaction(async (tx: any) => {
    const asset = await tx.itemGalleryImage.findFirst({
      where: { id: assetId, itemId },
      select: { id: true, isPrimary: true },
    });

    if (!asset) return null;

    await tx.itemGalleryImage.delete({
      where: { id: asset.id },
    });

    if (asset.isPrimary) {
      const replacement = await tx.itemGalleryImage.findFirst({
        where: { itemId },
        orderBy: [{ visible: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      if (replacement?.id) {
        await tx.itemGalleryImage.update({
          where: { id: replacement.id },
          data: { isPrimary: true, slot: "cover" },
        });
      }
    }

    return asset;
  });

  if (!deleted) return null;

  await invalidateCardapioIndexCache();
  return deleted;
}
