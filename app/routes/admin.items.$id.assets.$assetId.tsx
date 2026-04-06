import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { deleteItemAsset, listItemAssetsAdmin } from "~/domain/item/item-assets.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "DELETE") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const itemId = params.id;
  const assetId = params.assetId;

  if (!itemId || !assetId) {
    return json({ error: "missing_params" }, { status: 400 });
  }

  const deleted = await deleteItemAsset(itemId, assetId);
  if (!deleted) {
    return json({ error: "asset_not_found" }, { status: 404 });
  }

  const assets = await listItemAssetsAdmin(itemId);
  return json(assets);
}
