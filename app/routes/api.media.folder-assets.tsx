import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { isSafePath, normalizePath, toKind, type UploadKind } from "~/domain/media/media.shared";

function parseKindParam(value: string | null): "all" | UploadKind {
  if (value === "image" || value === "video") return value;
  return "all";
}

function parseBooleanParam(value: string | null, fallback = false) {
  if (value === null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseLimitParam(value: string | null, fallback = 100) {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(200, Math.trunc(parsed)));
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const folderPath = normalizePath(url.searchParams.get("folder") || "");

  if (!folderPath || !isSafePath(folderPath)) {
    return json({ ok: false, error: "invalid_folder" }, { status: 400 });
  }

  const kind = parseKindParam(url.searchParams.get("kind"));
  const recursive = parseBooleanParam(url.searchParams.get("recursive"), false);
  const limit = parseLimitParam(url.searchParams.get("limit"), 100);

  const mediaService = await import("~/domain/media/media.service.server");
  const items = await mediaService.listAssetsByFolderPath({
    folderPath,
    kind,
    recursive,
    limit,
  });

  return json({
    ok: true,
    folderPath,
    kind,
    recursive,
    total: items.length,
    items: items.map((item) => ({
      id: item.id,
      kind: toKind(item.kind),
      url: item.url,
      fileName: item.fileName,
      assetPath: item.assetPath,
      uploadedAt: item.uploadedAt,
      sizeBytes: item.sizeBytes,
    })),
    links: {
      self: `${url.pathname}?folder=${encodeURIComponent(folderPath)}${kind !== "all" ? `&kind=${kind}` : ""}${recursive ? "&recursive=true" : ""}&limit=${limit}`,
      videosOnly: `${url.pathname}?folder=${encodeURIComponent(folderPath)}&kind=video${recursive ? "&recursive=true" : ""}&limit=${limit}`,
      imagesOnly: `${url.pathname}?folder=${encodeURIComponent(folderPath)}&kind=image${recursive ? "&recursive=true" : ""}&limit=${limit}`,
    },
  });
}
