import prismaClient from "~/lib/prisma/client.server";
import { invalidateCardapioIndexCache } from "./cardapio-cache.server";

export type MenuItemAssetAdminDTO = {
  id: string;
  url: string;
  kind: "image" | "video";
  slot: string | null;
  visible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type MenuItemAssetsListDTO = {
  primary: MenuItemAssetAdminDTO | null;
  gallery: MenuItemAssetAdminDTO[];
  assets: MenuItemAssetAdminDTO[];
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
}): MenuItemAssetAdminDTO {
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

export async function listMenuItemAssetsAdmin(
  menuItemId: string
): Promise<MenuItemAssetsListDTO> {
  const images = await prismaClient.menuItemGalleryImage.findMany({
    where: { menuItemId },
    orderBy: [
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
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
  const primary = mapped.find((i) => i.isPrimary) || null;
  const gallery = mapped
    .filter((i) => !i.isPrimary)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());

  return {
    primary,
    gallery,
    assets: mapped,
  };
}

type CreateMenuItemAssetInput = {
  menuItemId: string;
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

export async function createMenuItemAsset(input: CreateMenuItemAssetInput) {
  const created = await prismaClient.$transaction(async (tx) => {
    const imageCount = await tx.menuItemGalleryImage.count({
      where: { menuItemId: input.menuItemId },
    });

    const last = await tx.menuItemGalleryImage.findFirst({
      where: { menuItemId: input.menuItemId },
      orderBy: [{ sortOrder: "desc" }],
      select: { sortOrder: true },
    });

    const shouldSetPrimary = Boolean(input.isPrimary) || imageCount === 0;
    const nextSortOrder = (last?.sortOrder || 0) + 1;

    if (shouldSetPrimary) {
      await tx.menuItemGalleryImage.updateMany({
        where: { menuItemId: input.menuItemId },
        data: { isPrimary: false },
      });
    }

    return tx.menuItemGalleryImage.create({
      data: {
        menuItemId: input.menuItemId,
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

export async function setMenuItemAssetPrimary(
  menuItemId: string,
  assetId: string
) {
  const updated = await prismaClient.$transaction(async (tx) => {
    const asset = await tx.menuItemGalleryImage.findFirst({
      where: { id: assetId, menuItemId },
      select: { id: true, kind: true },
    });

    if (!asset) return null;

    await tx.menuItemGalleryImage.updateMany({
      where: { menuItemId },
      data: { isPrimary: false, slot: "gallery" },
    });

    return tx.menuItemGalleryImage.update({
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

export async function setMenuItemAssetVisibility(
  menuItemId: string,
  assetId: string,
  visible: boolean
) {
  const asset = await prismaClient.menuItemGalleryImage.findFirst({
    where: { id: assetId, menuItemId },
    select: { id: true },
  });

  if (!asset) return null;

  const updated = await prismaClient.menuItemGalleryImage.update({
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

export async function reorderMenuItemGalleryAssets(
  menuItemId: string,
  orderedIds: string[]
) {
  const gallery = await prismaClient.menuItemGalleryImage.findMany({
    where: { menuItemId, isPrimary: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const validIds = new Set(gallery.map((g) => g.id));
  const incoming = Array.from(new Set((orderedIds || []).filter((id) => validIds.has(id))));
  const missing = gallery.map((g) => g.id).filter((id) => !incoming.includes(id));
  const finalOrder = [...incoming, ...missing];

  await prismaClient.$transaction(
    finalOrder.map((id, index) =>
      prismaClient.menuItemGalleryImage.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  );

  await invalidateCardapioIndexCache();
}

export async function deleteMenuItemAsset(menuItemId: string, assetId: string) {
  const deleted = await prismaClient.$transaction(async (tx) => {
    const asset = await tx.menuItemGalleryImage.findFirst({
      where: { id: assetId, menuItemId },
      select: { id: true, isPrimary: true },
    });

    if (!asset) return null;

    await tx.menuItemGalleryImage.delete({
      where: { id: asset.id },
    });

    if (asset.isPrimary) {
      const replacement = await tx.menuItemGalleryImage.findFirst({
        where: { menuItemId },
        orderBy: [
          { visible: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
        select: { id: true },
      });

        if (replacement?.id) {
          await tx.menuItemGalleryImage.update({
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
