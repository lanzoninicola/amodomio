export type UploadKind = "image" | "video";

export type MediaUploadApiPayload = {
  ok: boolean;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
  url: string;
};

export type MediaFolder = {
  id: string;
  path: string;
  name: string;
  parentPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: string;
  kind: UploadKind;
  url: string;
  assetPath: string;
  fileName: string;
  assetKey: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
};

export type LibraryPayload = {
  folders: MediaFolder[];
  assets: MediaAsset[];
};

export const FOLDER_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;

export function normalizePath(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

export function normalizeFolderSegment(value: string) {
  return value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
}

export function normalizeStorageKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

export function isSafePath(value: string) {
  if (!value) return false;
  if (value.includes("..")) return false;
  return /^[a-zA-Z0-9/_-]+$/.test(value);
}

export function getParentPath(path: string) {
  const normalized = normalizePath(path);
  if (!normalized || !normalized.includes("/")) return "";
  return normalized.slice(0, normalized.lastIndexOf("/"));
}

export function getFolderLabel(path: string) {
  const normalized = normalizePath(path);
  if (!normalized) return "Raiz";
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export function getFolderLineage(path: string) {
  const normalized = normalizePath(path);
  if (!normalized) return [] as string[];
  const parts = normalized.split("/");
  const folders: string[] = [];

  for (let index = 0; index < parts.length; index++) {
    folders.push(parts.slice(0, index + 1).join("/"));
  }

  return folders;
}

export function replacePathPrefix(source: string, oldPrefix: string, newPrefix: string) {
  const normalizedSource = normalizePath(source);
  const normalizedOld = normalizePath(oldPrefix);
  const normalizedNew = normalizePath(newPrefix);

  if (normalizedSource === normalizedOld) return normalizedNew;
  if (!normalizedSource.startsWith(`${normalizedOld}/`)) return normalizedSource;

  const tail = normalizedSource.slice(normalizedOld.length + 1);
  return normalizePath(`${normalizedNew}/${tail}`);
}

export function toKind(kind: unknown): UploadKind {
  return String(kind) === "video" ? "video" : "image";
}

export function parseMediaUploadApiPayload(input: {
  payload: unknown;
  fallbackKind: UploadKind;
  fallbackFolderPath: string;
  fallbackAssetKey: string;
}) {
  if (!input.payload || typeof input.payload !== "object") {
    return null as MediaUploadApiPayload | null;
  }

  const raw = input.payload as Record<string, unknown>;
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url) {
    return null as MediaUploadApiPayload | null;
  }

  const kind = toKind(raw.kind ?? input.fallbackKind);
  const folderPathRaw =
    typeof raw.folderPath === "string"
      ? raw.folderPath
      : typeof raw.path === "string"
        ? raw.path
        : typeof raw.menuItemId === "string"
          ? raw.menuItemId
          : input.fallbackFolderPath;
  const folderPath = normalizePath(folderPathRaw) || normalizePath(input.fallbackFolderPath);
  const assetKeyRaw =
    typeof raw.assetKey === "string"
      ? raw.assetKey
      : typeof raw.slot === "string"
        ? raw.slot
        : input.fallbackAssetKey;
  const assetKey = normalizeStorageKey(assetKeyRaw) || input.fallbackAssetKey;
  const ok = typeof raw.ok === "boolean" ? raw.ok : true;

  return {
    ok,
    kind,
    folderPath,
    assetKey,
    url,
  } as MediaUploadApiPayload;
}
