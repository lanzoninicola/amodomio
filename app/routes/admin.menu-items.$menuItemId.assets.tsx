import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import {
  createMenuItemAsset,
  listMenuItemAssetsAdmin,
} from "~/domain/cardapio/menu-item-assets.server";
import { getMenuItemMediaFolderPath } from "~/domain/menu-item-assets/menu-item-assets.shared";
import { registerMediaAssetInLibrary, uploadFileToMediaApi } from "~/domain/media/media.service.server";
import { normalizeStorageKey, type UploadKind } from "~/domain/media/media.shared";

function parseBooleanValue(value: FormDataEntryValue | string | null | undefined, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function isMultipartFile(value: FormDataEntryValue | null): value is File {
  if (!value) return false;
  if (typeof File !== "undefined" && value instanceof File) return true;
  return value instanceof Blob && typeof (value as { name?: unknown }).name === "string";
}

function inferKindFromMimeOrUrl(input: { mimeType?: string | null; url?: string | null }): UploadKind {
  const mime = String(input.mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";

  const url = String(input.url || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(url)) return "video";
  return "image";
}

function getFileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return segment || "asset";
  } catch {
    return "asset";
  }
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function getFormatFromFileName(fileName: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() || null;
}

function getFileExtension(fileName: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() || "";
}

function buildAssetFileName(originalFileName: string) {
  const normalizedBase = normalizeStorageKey(getBaseName(originalFileName));
  const extension = getFileExtension(originalFileName);
  const baseName = normalizedBase ? `asset-${normalizedBase}` : `asset-${Date.now()}`;
  return extension ? `${baseName}.${extension}` : baseName;
}

function pickDetailMessage(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details.trim() || null;
  if (typeof details !== "object") return null;

  const raw = details as Record<string, unknown>;
  const directMessage = [raw.message, raw.error, raw.detail].find(
    (value) => typeof value === "string" && value.trim()
  ) as string | undefined;
  if (directMessage) return directMessage.trim();

  return (
    pickDetailMessage(raw.details) ||
    pickDetailMessage(raw.v2Details) ||
    pickDetailMessage(raw.health) ||
    null
  );
}

function getUploadFailureMessage(input: {
  status: number;
  endpoint: "v2" | "legacy";
  details: unknown;
  v2Status?: number;
  v2Details?: unknown;
}) {
  const specific =
    pickDetailMessage(input.details) ||
    pickDetailMessage(input.v2Details) ||
    `falha no upload (${input.endpoint}, status ${input.status})`;

  if (input.endpoint === "legacy" && input.v2Status === 404) {
    return `Fallback legado acionado após 404 no /v2/upload, mas também falhou: ${specific}`;
  }

  return `Upload de mídia falhou: ${specific}`;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const menuItemId = params.menuItemId;
  if (!menuItemId) {
    return json({ error: "missing_menu_item_id" }, { status: 400 });
  }

  const assets = await listMenuItemAssetsAdmin(menuItemId);
  return json(assets);
}

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const menuItemId = params.menuItemId;
  if (!menuItemId) {
    return json({ error: "missing_menu_item_id" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (isMultipart) {
    const formData = await request.formData();
    const file = formData.get("file");
    const visible = parseBooleanValue(formData.get("visible"), true);
    const isPrimary = parseBooleanValue(formData.get("isPrimary"), false);

    if (!isMultipartFile(file)) {
      return json({ error: "missing_file" }, { status: 400 });
    }

    const mediaApiKey = process.env.MEDIA_UPLOAD_API_KEY;
    if (!mediaApiKey) {
      return json(
        { error: "missing_media_upload_api_key", message: "Configure MEDIA_UPLOAD_API_KEY no servidor." },
        { status: 500 }
      );
    }

    const fileKind = inferKindFromMimeOrUrl({ mimeType: file.type });
    const assetFileName = buildAssetFileName(file.name);
    const folderPath = getMenuItemMediaFolderPath(menuItemId);
    const assetKey = normalizeStorageKey(getBaseName(assetFileName)) || `asset-${Date.now()}`;

    let uploadResult: Awaited<ReturnType<typeof uploadFileToMediaApi>>;
    try {
      uploadResult = await uploadFileToMediaApi({
        file,
        uploadFileName: assetFileName,
        kind: fileKind,
        folderPath,
        assetKey,
      });
    } catch (error) {
      return json(
        {
          error: "media_upload_request_failed",
          message: "Falha ao comunicar com o serviço de mídia.",
          details: String((error as Error)?.message || "unknown_upload_error"),
        },
        { status: 502 }
      );
    }

    if (!uploadResult.ok) {
      return json(
        {
          error: "media_upload_failed",
          message: getUploadFailureMessage({
            status: uploadResult.status,
            endpoint: uploadResult.endpoint,
            details: uploadResult.details,
            v2Status: uploadResult.v2Status,
            v2Details: uploadResult.v2Details,
          }),
          status: uploadResult.status,
          endpoint: uploadResult.endpoint,
          details: uploadResult.details,
          fallback: uploadResult.endpoint === "legacy",
          v2Status: uploadResult.v2Status,
          v2Details: uploadResult.v2Details,
        },
        { status: 502 }
      );
    }

    const uploadedUrl = uploadResult.data.url;
    const uploadRaw =
      uploadResult.rawPayload && typeof uploadResult.rawPayload === "object"
        ? (uploadResult.rawPayload as Record<string, unknown>)
        : null;

    const savedAsset = await registerMediaAssetInLibrary({
      kind: fileKind,
      url: uploadedUrl,
      assetPath: folderPath,
      fileName: assetFileName,
      assetKey: uploadResult.data.assetKey,
      sizeBytes: file.size,
    });

    const created = await createMenuItemAsset({
      menuItemId,
      url: uploadedUrl,
      kind: fileKind,
      visible,
      isPrimary,
      assetId: typeof uploadRaw?.asset_id === "string" ? uploadRaw.asset_id : null,
      mediaAssetId: savedAsset.id,
      assetFolder: savedAsset.folderPath,
      originalFileName: file.name,
      displayName: getBaseName(assetFileName),
      format: getFormatFromFileName(assetFileName),
      width: typeof uploadRaw?.width === "number" ? uploadRaw.width : null,
      height: typeof uploadRaw?.height === "number" ? uploadRaw.height : null,
      thumbnailUrl: typeof uploadRaw?.thumbnail_url === "string" ? uploadRaw.thumbnail_url : null,
      publicId: typeof uploadRaw?.public_id === "string" ? uploadRaw.public_id : null,
    });

    return json(created, { status: 201 });
  }

  let body: {
    url?: string;
    visible?: boolean;
    isPrimary?: boolean;
    kind?: UploadKind;
  } = {};

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return json({ error: "missing_url" }, { status: 400 });
  }

  const kind = body?.kind === "video" || body?.kind === "image"
    ? body.kind
    : inferKindFromMimeOrUrl({ url });
  const fileName = getFileNameFromUrl(url);
  const folderPath = getMenuItemMediaFolderPath(menuItemId);
  const savedAsset = await registerMediaAssetInLibrary({
    kind,
    url,
    assetPath: folderPath,
    fileName,
    assetKey: normalizeStorageKey(fileName) || null,
    sizeBytes: null,
  });

  const created = await createMenuItemAsset({
    menuItemId,
    url,
    kind,
    visible: typeof body?.visible === "boolean" ? body.visible : true,
    isPrimary: typeof body?.isPrimary === "boolean" ? body.isPrimary : false,
    mediaAssetId: savedAsset.id,
    assetFolder: savedAsset.folderPath,
    originalFileName: fileName,
    displayName: getBaseName(fileName),
    format: getFormatFromFileName(fileName),
  });

  return json(created, { status: 201 });
}
