export type MenuItemAssetKind = "image" | "video";

export type MenuItemAssetDto = {
  id: string;
  url: string;
  kind: MenuItemAssetKind;
  slot: string | null;
  visible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};

export function getMenuItemAssetsApiEndpoints(menuItemId: string) {
  const basePath = `/admin/menu-items/${menuItemId}/assets`;
  return {
    list: basePath,
    order: `${basePath}/order`,
    item: (assetId: string) => `${basePath}/${assetId}`,
    primary: (assetId: string) => `${basePath}/${assetId}/primary`,
    visibility: (assetId: string) => `${basePath}/${assetId}/visibility`,
  };
}

export function getMenuItemMediaFolderPath(menuItemId: string) {
  return `menu-items/${menuItemId}`;
}

function toMenuItemAssetKind(value: unknown): MenuItemAssetKind {
  return value === "video" ? "video" : "image";
}

function toMenuItemAsset(value: unknown): MenuItemAssetDto | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const url = typeof raw.url === "string" ? raw.url : "";

  if (!id || !url) return null;

  return {
    id,
    url,
    kind: toMenuItemAssetKind(raw.kind),
    slot: typeof raw.slot === "string" ? raw.slot : null,
    visible: Boolean(raw.visible),
    isPrimary: Boolean(raw.isPrimary),
    sortOrder: Number(raw.sortOrder || 0),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString(),
  };
}

export function parseMenuItemAssetsApiResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return [] as MenuItemAssetDto[];

  const raw = payload as Record<string, unknown>;
  const primary = toMenuItemAsset(raw.primary);

  const gallery = Array.isArray(raw.gallery)
    ? raw.gallery.map(toMenuItemAsset).filter((asset): asset is MenuItemAssetDto => asset !== null)
    : [];

  if (primary || gallery.length > 0) {
    return [...(primary ? [primary] : []), ...gallery];
  }

  if (!Array.isArray(raw.assets)) return [] as MenuItemAssetDto[];

  return raw.assets
    .map(toMenuItemAsset)
    .filter((asset): asset is MenuItemAssetDto => asset !== null);
}
