import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { isSafePath, normalizePath, type UploadKind } from "~/domain/media/media.shared";

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as {
    url?: string;
    kind?: string;
    assetPath?: string;
    fileName?: string;
    assetKey?: string | null;
    sizeBytes?: number | null;
  } | null;

  const url = String(body?.url || "").trim();
  const kindRaw = String(body?.kind || "image");
  const kind: UploadKind = kindRaw === "video" ? "video" : "image";
  const assetPath = normalizePath(String(body?.assetPath || ""));
  const fileName = String(body?.fileName || "").trim();
  const assetKey = body?.assetKey ? String(body.assetKey).trim() : null;
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;

  if (!url || !fileName || !assetPath || !isSafePath(assetPath)) {
    return json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const mediaService = await import("~/domain/media/media.service.server");

  await mediaService.registerMediaAssetInLibrary({ kind, url, assetPath, fileName, assetKey, sizeBytes });

  const payload = await mediaService.readLibraryFromDb();

  return json({ ok: true, payload });
}
