export type UploadKind = "image" | "video" | "audio";
export const MEDIA_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export type ImageVariants = Record<string, string>;

export type MediaUploadApiPayload = {
  ok: boolean;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
  url: string;
  thumbnailUrl?: string | null;
  variants?: ImageVariants | null;
  width?: number | null;
  height?: number | null;
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

const SUPPORTED_VIDEO_UPLOAD_EXTENSIONS = [".mp4", ".webm"];
const SUPPORTED_VIDEO_UPLOAD_TYPES = new Set(["video/mp4", "video/webm"]);

export const FOLDER_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;

export function getUploadAccept(kind: UploadKind) {
  if (kind === "video") return "video/mp4,video/webm,.mp4,.webm";
  if (kind === "audio") return "audio/*";
  return "image/*";
}

export function getUnsupportedMediaUploadMessage(
  file: Pick<File, "name" | "type">,
  kind: UploadKind
) {
  if (kind !== "video") return null;

  const fileName = file.name.trim().toLowerCase();
  const fileType = file.type.trim().toLowerCase();
  const isQuickTime =
    fileType === "video/quicktime" || fileName.endsWith(".mov");
  if (isQuickTime) {
    return "Vídeo MOV/QuickTime do iPhone ainda não é aceito pelo upload interno. Converta para MP4 ou use a aba Link externo.";
  }

  const hasSupportedExtension = SUPPORTED_VIDEO_UPLOAD_EXTENSIONS.some(
    (extension) => fileName.endsWith(extension)
  );
  const hasSupportedType =
    fileType.length > 0 && SUPPORTED_VIDEO_UPLOAD_TYPES.has(fileType);
  if (!hasSupportedExtension && !hasSupportedType) {
    return "Envie vídeo em MP4 ou WebM.";
  }

  return null;
}

export function getUnsupportedMediaUploadMessages(
  files: Array<Pick<File, "name" | "type">>,
  kind: UploadKind
) {
  return files
    .map((file) => ({
      fileName: file.name,
      message: getUnsupportedMediaUploadMessage(file, kind),
      type: file.type || null,
    }))
    .filter(
      (
        item
      ): item is { fileName: string; message: string; type: string | null } =>
        Boolean(item.message)
    );
}

export function formatUnsupportedMediaUploadMessage(
  unsupportedFiles: Array<{ fileName: string; message: string }>
) {
  if (unsupportedFiles.length === 0) return "";

  const first = unsupportedFiles[0];
  if (unsupportedFiles.length === 1) {
    return `${first.fileName}: ${first.message}`;
  }

  const uniqueMessages = Array.from(
    new Set(unsupportedFiles.map((item) => item.message))
  );
  const fileNames = unsupportedFiles.map((item) => item.fileName).join(", ");
  return `${
    unsupportedFiles.length
  } arquivos não podem ser enviados (${fileNames}). ${uniqueMessages.join(
    " "
  )}`;
}

export function getMediaUploadFailureMessage(input: {
  failedFiles: string[];
  failureDetails: Array<{ fileName: string; status: number; details: unknown }>;
}) {
  const failuresWithReason = input.failureDetails.map((detail) => ({
    fileName: detail.fileName,
    reason: getMediaUploadFailureReason(detail),
  }));

  if (failuresWithReason.length === 1) {
    const failure = failuresWithReason[0];
    return `${failure.fileName} não foi enviado. Motivo: ${failure.reason}`;
  }

  if (failuresWithReason.length > 1) {
    const groupedReasons = Array.from(
      new Set(failuresWithReason.map((failure) => failure.reason))
    );
    return `${
      failuresWithReason.length
    } arquivos não foram enviados. Motivo: ${groupedReasons.join(" ")}`;
  }

  if (input.failedFiles.length === 1) {
    return `${input.failedFiles[0]} não foi enviado. Motivo: não foi possível confirmar a causa exata. Tente novamente ou use a aba Link externo.`;
  }

  return "Não foi possível enviar o arquivo. Motivo: não foi possível confirmar a causa exata. Tente novamente ou use a aba Link externo.";
}

export function getMediaUploadPartialFailureMessage(input: {
  failedFiles: string[];
  failureDetails: Array<{ fileName: string; status: number; details: unknown }>;
}) {
  if (!input.failedFiles.length) return "";

  const failureMessage = getMediaUploadFailureMessage(input);
  return ` Alguns arquivos não foram enviados. ${failureMessage}`;
}

function getMediaUploadFailureReason(detail: {
  fileName: string;
  status: number;
  details: unknown;
}) {
  const serializedDetails = JSON.stringify(detail.details || {})
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    detail.status === 415 ||
    serializedDetails.includes("unsupported media type")
  ) {
    if (detail.fileName.toLowerCase().endsWith(".mov")) {
      return "vídeo MOV/QuickTime do iPhone ainda não é aceito pelo upload interno. Converta para MP4 ou use a aba Link externo.";
    }
    return "formato não aceito pelo upload interno. Para vídeo, envie MP4/WebM ou use a aba Link externo.";
  }

  if (detail.status === 413 || serializedDetails.includes("too large")) {
    return "o arquivo é grande demais para o upload interno. Reduza o arquivo ou use um link externo.";
  }

  if (detail.status === 401 || detail.status === 403) {
    return "a chave de upload foi recusada pelo servidor de mídia. Verifique a configuração do upload.";
  }

  if (detail.status === 404) {
    return "o endpoint de upload de mídia não foi encontrado. Verifique a configuração do servidor de mídia.";
  }

  if (detail.status >= 500) {
    return "o servidor de mídia respondeu com erro temporário. Tente novamente em alguns minutos.";
  }

  return `o servidor de mídia recusou o arquivo com status ${detail.status}.`;
}

export function getMediaUploadFailureStatus(input: {
  failureDetails: Array<{ status: number }>;
}) {
  if (
    input.failureDetails.length > 0 &&
    input.failureDetails.every((detail) => detail.status === 415)
  ) {
    return 415;
  }

  return 502;
}

export function normalizePath(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

export function normalizeFolderSegment(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");
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

export function replacePathPrefix(
  source: string,
  oldPrefix: string,
  newPrefix: string
) {
  const normalizedSource = normalizePath(source);
  const normalizedOld = normalizePath(oldPrefix);
  const normalizedNew = normalizePath(newPrefix);

  if (normalizedSource === normalizedOld) return normalizedNew;
  if (!normalizedSource.startsWith(`${normalizedOld}/`))
    return normalizedSource;

  const tail = normalizedSource.slice(normalizedOld.length + 1);
  return normalizePath(`${normalizedNew}/${tail}`);
}

export function toKind(kind: unknown): UploadKind {
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  return "image";
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
      : input.fallbackFolderPath;
  const folderPath =
    normalizePath(folderPathRaw) || normalizePath(input.fallbackFolderPath);
  const assetKeyRaw =
    typeof raw.assetKey === "string" ? raw.assetKey : input.fallbackAssetKey;
  const assetKey = normalizeStorageKey(assetKeyRaw) || input.fallbackAssetKey;
  const ok = typeof raw.ok === "boolean" ? raw.ok : true;

  const thumbnailUrl =
    typeof raw.thumbnail_url === "string" && raw.thumbnail_url.trim()
      ? raw.thumbnail_url.trim()
      : null;

  const variants =
    raw.variants &&
    typeof raw.variants === "object" &&
    !Array.isArray(raw.variants)
      ? (raw.variants as ImageVariants)
      : null;

  const width =
    typeof raw.width === "number" && Number.isFinite(raw.width)
      ? raw.width
      : null;

  const height =
    typeof raw.height === "number" && Number.isFinite(raw.height)
      ? raw.height
      : null;

  return {
    ok,
    kind,
    folderPath,
    assetKey,
    url,
    thumbnailUrl,
    variants,
    width,
    height,
  } as MediaUploadApiPayload;
}
