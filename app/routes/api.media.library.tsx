import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const mediaService = await import("~/domain/media/media.service.server");
  const library = await mediaService.readLibraryFromDb();

  return json({
    ok: true,
    library,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "DELETE") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as {
    assetId?: unknown;
  } | null;
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";

  if (!assetId) {
    return json({ ok: false, error: "missing_asset_id" }, { status: 400 });
  }

  const mediaService = await import("~/domain/media/media.service.server");
  const library = await mediaService.deleteAssetById(assetId);

  return json({
    ok: true,
    library,
  });
}
