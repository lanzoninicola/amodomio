import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { deleteMenuItemAsset, listMenuItemAssetsAdmin } from "~/domain/cardapio/menu-item-assets.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "DELETE") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const menuItemId = params.menuItemId;
  const assetId = params.assetId;

  if (!menuItemId || !assetId) {
    return json({ error: "missing_params" }, { status: 400 });
  }

  const deleted = await deleteMenuItemAsset(menuItemId, assetId);
  if (!deleted) {
    return json({ error: "asset_not_found" }, { status: 404 });
  }

  const assets = await listMenuItemAssetsAdmin(menuItemId);
  return json(assets);
}
