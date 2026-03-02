import prismaClient from "~/lib/prisma/client.server";
import {
  getFolderLabel,
  getFolderLineage,
  isSafePath,
  parseMediaUploadApiPayload,
  getParentPath,
  normalizePath,
  normalizeStorageKey,
  replacePathPrefix,
  toKind,
  type LibraryPayload,
  type UploadKind,
} from "./media.shared";

function buildUploadV2Url(input: {
  mediaApiBaseUrl: string;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
}) {
  const url = new URL(`${input.mediaApiBaseUrl}/v2/upload`);
  url.searchParams.set("kind", input.kind);
  url.searchParams.set("folderPath", input.folderPath);
  url.searchParams.set("assetKey", input.assetKey);
  return url.toString();
}

function buildLegacyUploadUrl(input: {
  mediaApiBaseUrl: string;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
}) {
  const url = new URL(`${input.mediaApiBaseUrl}/upload`);
  url.searchParams.set("kind", input.kind);
  // Some legacy environments validate both generic and legacy query names.
  url.searchParams.set("folderPath", input.folderPath);
  url.searchParams.set("path", input.folderPath);
  url.searchParams.set("assetKey", input.assetKey);
  url.searchParams.set("menuItemId", input.folderPath);
  url.searchParams.set("slot", input.assetKey);
  return url.toString();
}

export function getMediaApiBaseUrl() {
  return (process.env.MEDIA_API_BASE_URL || "https://media-api.amodomio.com.br").replace(/\/+$/, "");
}

export function getMediaBaseUrl() {
  return (process.env.MEDIA_BASE_URL || "https://media.amodomio.com.br").replace(/\/+$/, "");
}

export function isMissingRelationError(error: unknown) {
  const message = String((error as Error)?.message || "").toLowerCase();
  return message.includes("media_folders") || message.includes("media_assets");
}

export type MediaApiHealthcheckResult = {
  ok: boolean;
  endpoint: "/healthcheck" | "/health" | null;
  status: number | null;
  details: unknown;
};

async function requestMediaHealthEndpoint(input: {
  mediaApiBaseUrl: string;
  endpoint: "/healthcheck" | "/health";
}) {
  const response = await fetch(`${input.mediaApiBaseUrl}${input.endpoint}`, {
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const ok = response.ok && Boolean((payload as { ok?: unknown } | null)?.ok);
  return {
    ok,
    endpoint: input.endpoint,
    status: response.status,
    details: payload,
  } as MediaApiHealthcheckResult;
}

export async function checkMediaApiHealth() {
  const mediaApiBaseUrl = getMediaApiBaseUrl();
  let healthcheckResult: MediaApiHealthcheckResult | null = null;

  try {
    healthcheckResult = await requestMediaHealthEndpoint({
      mediaApiBaseUrl,
      endpoint: "/healthcheck",
    });
    if (healthcheckResult.ok) {
      return healthcheckResult;
    }
  } catch (error) {
    healthcheckResult = {
      ok: false,
      endpoint: "/healthcheck",
      status: null,
      details: String((error as Error)?.message || "healthcheck_request_failed"),
    };
  }

  try {
    const health = await requestMediaHealthEndpoint({
      mediaApiBaseUrl,
      endpoint: "/health",
    });
    if (health.ok) {
      return health;
    }

    return {
      ok: false,
      endpoint: health.endpoint,
      status: health.status,
      details: {
        healthcheck: healthcheckResult,
        health,
      },
    } as MediaApiHealthcheckResult;
  } catch (error) {
    return {
      ok: false,
      endpoint: "/health",
      status: null,
      details: {
        healthcheck: healthcheckResult,
        health: String((error as Error)?.message || "health_request_failed"),
      },
    } as MediaApiHealthcheckResult;
  }
}

export type MediaApiUploadFailure = {
  ok: false;
  status: number;
  endpoint: "v2" | "legacy";
  details: unknown;
  v2Status?: number;
  v2Details?: unknown;
};

export type MediaApiUploadResult = {
  ok: true;
  status: number;
  endpoint: "v2" | "legacy";
  data: {
    url: string;
    kind: UploadKind;
    folderPath: string;
    assetKey: string;
  };
  rawPayload: unknown;
} | MediaApiUploadFailure;

async function postToMediaUploadEndpoint(input: {
  endpoint: "v2" | "legacy";
  url: string;
  file: File;
  uploadFileName?: string;
  mediaApiKey: string;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
}) {
  const uploadBody = new FormData();
  uploadBody.append("file", input.file, input.uploadFileName || input.file.name || "asset");

  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "x-api-key": input.mediaApiKey,
    },
    body: uploadBody,
  });
  const payload = await response.json().catch(() => null);
  const normalized = parseMediaUploadApiPayload({
    payload,
    fallbackKind: input.kind,
    fallbackFolderPath: input.folderPath,
    fallbackAssetKey: input.assetKey,
  });

  if (!response.ok || !normalized || !normalized.ok) {
    return {
      ok: false,
      status: response.status,
      endpoint: input.endpoint,
      details: payload,
    } as MediaApiUploadFailure;
  }

  return {
    ok: true,
    status: response.status,
    endpoint: input.endpoint,
    data: normalized,
    rawPayload: payload,
  } as MediaApiUploadResult;
}

export async function uploadFileToMediaApi(input: {
  file: File;
  uploadFileName?: string;
  kind: UploadKind;
  folderPath: string;
  assetKey: string;
}) {
  const mediaApiBaseUrl = getMediaApiBaseUrl();
  const mediaApiKey = process.env.MEDIA_UPLOAD_API_KEY;
  if (!mediaApiKey) {
    throw new Error("missing_upload_api_key");
  }

  const normalizedFolderPath = normalizePath(input.folderPath);
  const requestedAssetKey = normalizeStorageKey(input.assetKey) || `asset-${Date.now()}`;

  const v2Result = await postToMediaUploadEndpoint({
    endpoint: "v2",
    url: buildUploadV2Url({
      mediaApiBaseUrl,
      kind: input.kind,
      folderPath: normalizedFolderPath,
      assetKey: requestedAssetKey,
    }),
    file: input.file,
    uploadFileName: input.uploadFileName,
    mediaApiKey,
    kind: input.kind,
    folderPath: normalizedFolderPath,
    assetKey: requestedAssetKey,
  });

  if (v2Result.ok) {
    return v2Result;
  }

  if (v2Result.status !== 404) {
    return v2Result;
  }

  const legacyResult = await postToMediaUploadEndpoint({
    endpoint: "legacy",
    url: buildLegacyUploadUrl({
      mediaApiBaseUrl,
      kind: input.kind,
      folderPath: normalizedFolderPath,
      assetKey: requestedAssetKey,
    }),
    file: input.file,
    uploadFileName: input.uploadFileName,
    mediaApiKey,
    kind: input.kind,
    folderPath: normalizedFolderPath,
    assetKey: requestedAssetKey,
  });

  if (legacyResult.ok) {
    return legacyResult;
  }

  return {
    ...legacyResult,
    v2Status: v2Result.status,
    v2Details: v2Result.details,
  } as MediaApiUploadResult;
}

export async function readLibraryFromDb(): Promise<LibraryPayload> {
  try {
    const folders = await prismaClient.$queryRaw<Array<{
      id: string;
      path: string;
      name: string;
      parent_path: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, path, name, parent_path, created_at, updated_at
      FROM media_folders
      ORDER BY path ASC
    `;

    const assets = await prismaClient.$queryRaw<Array<{
      id: string;
      kind: string;
      url: string;
      folder_path: string;
      file_name: string;
      storage_key: string | null;
      size_bytes: bigint | number | null;
      created_at: Date;
    }>>`
      SELECT id, kind, url, folder_path, file_name, storage_key, size_bytes, created_at
      FROM media_assets
      ORDER BY created_at DESC
    `;

    return {
      folders: folders.map((row) => ({
        id: row.id,
        path: row.path,
        name: row.name,
        parentPath: row.parent_path,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      })),
      assets: assets.map((row) => ({
        id: row.id,
        kind: toKind(row.kind),
        url: row.url,
        assetPath: row.folder_path,
        fileName: row.file_name,
        assetKey: row.storage_key,
        sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
        uploadedAt: new Date(row.created_at).toISOString(),
      })),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { folders: [], assets: [] };
    }
    throw error;
  }
}

export async function ensureFolderLineage(path: string) {
  const lineage = getFolderLineage(path);
  for (const folderPath of lineage) {
    const parent = getParentPath(folderPath) || null;
    const name = getFolderLabel(folderPath);

    await prismaClient.$executeRaw`
      INSERT INTO media_folders (path, name, parent_path, created_at, updated_at)
      VALUES (${folderPath}, ${name}, ${parent}, NOW(), NOW())
      ON CONFLICT (path)
      DO UPDATE SET name = EXCLUDED.name, parent_path = EXCLUDED.parent_path, updated_at = NOW()
    `;
  }
}

export async function createFolderByPath(path: string) {
  await ensureFolderLineage(path);
  return readLibraryFromDb();
}

export async function renameFolderPath(oldPath: string, newPath: string) {
  const folders = await prismaClient.$queryRaw<Array<{ id: string; path: string }>>`
    SELECT id, path
    FROM media_folders
    WHERE path = ${oldPath} OR path LIKE ${`${oldPath}/%`}
    ORDER BY path ASC
  `;

  if (!folders.length) {
    return null;
  }

  const conflict = await prismaClient.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM media_folders WHERE path = ${newPath} LIMIT 1
  `;

  if (conflict.length > 0) {
    throw new Error("target_folder_conflict");
  }

  await prismaClient.$transaction(async (tx) => {
    for (const folder of folders) {
      const nextPath = replacePathPrefix(folder.path, oldPath, newPath);
      const nextParent = getParentPath(nextPath) || null;
      const nextName = getFolderLabel(nextPath);

      await tx.$executeRaw`
        UPDATE media_folders
        SET path = ${nextPath}, name = ${nextName}, parent_path = ${nextParent}, updated_at = NOW()
        WHERE id = ${folder.id}
      `;
    }

    await tx.$executeRaw`
      UPDATE media_assets
      SET folder_path = regexp_replace(folder_path, ${`^${oldPath}`}, ${newPath}), updated_at = NOW()
      WHERE folder_path = ${oldPath} OR folder_path LIKE ${`${oldPath}/%`}
    `;
  });

  return readLibraryFromDb();
}

export async function deleteFolderPath(path: string) {
  await prismaClient.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM media_assets
      WHERE folder_path = ${path} OR folder_path LIKE ${`${path}/%`}
    `;

    await tx.$executeRaw`
      DELETE FROM media_folders
      WHERE path = ${path} OR path LIKE ${`${path}/%`}
    `;
  });

  return readLibraryFromDb();
}

export async function deleteAssetById(assetId: string) {
  await prismaClient.$executeRaw`
    DELETE FROM media_assets
    WHERE id = ${assetId}
  `;

  return readLibraryFromDb();
}

export async function moveAsset(assetId: string, destinationPath: string) {
  await ensureFolderLineage(destinationPath);

  await prismaClient.$executeRaw`
    UPDATE media_assets
    SET folder_path = ${destinationPath}, updated_at = NOW()
    WHERE id = ${assetId}
  `;

  return readLibraryFromDb();
}

export async function uploadFilesToExternalService(input: {
  files: File[];
  kind: UploadKind;
  assetPath: string;
}) {
  const normalizedPath = normalizePath(input.assetPath);
  await ensureFolderLineage(normalizedPath);

  const failedFiles: string[] = [];
  let successCount = 0;

  for (let index = 0; index < input.files.length; index++) {
    const file = input.files[index];
    const assetKey = normalizeStorageKey(file.name) || `asset-${Date.now()}-${index + 1}`;
    const uploadResult = await uploadFileToMediaApi({
      file,
      kind: input.kind,
      folderPath: normalizedPath,
      assetKey,
    });

    if (!uploadResult.ok) {
      failedFiles.push(file.name);
      continue;
    }

    await prismaClient.$executeRaw`
      INSERT INTO media_assets (kind, url, folder_path, file_name, storage_key, size_bytes, created_at, updated_at)
      VALUES (${input.kind}, ${uploadResult.data.url}, ${normalizedPath}, ${file.name}, ${uploadResult.data.assetKey}, ${file.size}, NOW(), NOW())
    `;
    successCount += 1;
  }

  return {
    successCount,
    failedFiles,
    payload: await readLibraryFromDb(),
  };
}

export async function registerMediaAssetInLibrary(input: {
  kind: UploadKind;
  url: string;
  assetPath: string;
  fileName: string;
  assetKey?: string | null;
  sizeBytes?: number | null;
}) {
  const normalizedPath = normalizePath(input.assetPath);
  await ensureFolderLineage(normalizedPath);

  const existing = await prismaClient.$queryRaw<
    Array<{ id: string; folder_path: string; storage_key: string | null; size_bytes: bigint | number | null }>
  >`
    SELECT id, folder_path, storage_key, size_bytes
    FROM media_assets
    WHERE url = ${input.url}
      AND folder_path = ${normalizedPath}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const normalizedSizeBytes =
    typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes)
      ? Math.max(0, Math.trunc(input.sizeBytes))
      : null;

  if (existing.length > 0) {
    const row = existing[0];
    await prismaClient.$executeRaw`
      UPDATE media_assets
      SET
        kind = ${input.kind},
        file_name = ${input.fileName},
        storage_key = ${input.assetKey ?? row.storage_key},
        size_bytes = ${normalizedSizeBytes ?? row.size_bytes},
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
    return {
      id: row.id,
      folderPath: row.folder_path,
    };
  }

  const created = await prismaClient.$queryRaw<
    Array<{ id: string; folder_path: string }>
  >`
    INSERT INTO media_assets (kind, url, folder_path, file_name, storage_key, size_bytes, created_at, updated_at)
    VALUES (
      ${input.kind},
      ${input.url},
      ${normalizedPath},
      ${input.fileName},
      ${input.assetKey ?? null},
      ${normalizedSizeBytes},
      NOW(),
      NOW()
    )
    RETURNING id, folder_path
  `;

  return {
    id: created[0].id,
    folderPath: created[0].folder_path,
  };
}

export async function listAssetsByFolderPath(input: {
  folderPath: string;
  kind?: UploadKind | "all";
  recursive?: boolean;
  limit?: number;
}) {
  const folderPath = normalizePath(input.folderPath);
  if (!folderPath || !isSafePath(folderPath)) {
    return [] as Array<{
      id: string;
      kind: UploadKind;
      url: string;
      assetPath: string;
      fileName: string;
      assetKey: string | null;
      sizeBytes: number | null;
      uploadedAt: string;
    }>;
  }

  const kind = input.kind === "image" || input.kind === "video" ? input.kind : "all";
  const recursive = Boolean(input.recursive);
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit || 100)));

  try {
    const rows = recursive
      ? await prismaClient.$queryRaw<Array<{
          id: string;
          kind: string;
          url: string;
          folder_path: string;
          file_name: string;
          storage_key: string | null;
          size_bytes: bigint | number | null;
          created_at: Date;
        }>>`
          SELECT id, kind, url, folder_path, file_name, storage_key, size_bytes, created_at
          FROM media_assets
          WHERE (folder_path = ${folderPath} OR folder_path LIKE ${`${folderPath}/%`})
            AND (${kind === "all"} OR kind = ${kind})
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await prismaClient.$queryRaw<Array<{
          id: string;
          kind: string;
          url: string;
          folder_path: string;
          file_name: string;
          storage_key: string | null;
          size_bytes: bigint | number | null;
          created_at: Date;
        }>>`
          SELECT id, kind, url, folder_path, file_name, storage_key, size_bytes, created_at
          FROM media_assets
          WHERE folder_path = ${folderPath}
            AND (${kind === "all"} OR kind = ${kind})
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    return rows.map((row) => ({
      id: row.id,
      kind: toKind(row.kind),
      url: row.url,
      assetPath: row.folder_path,
      fileName: row.file_name,
      assetKey: row.storage_key,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      uploadedAt: new Date(row.created_at).toISOString(),
    }));
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }
}
