import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { setMenuItemAssetPrimary } from "~/domain/cardapio/menu-item-assets.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "PATCH") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const menuItemId = params.menuItemId;
  const assetId = params.assetId;

  if (!menuItemId || !assetId) {
    return json({ error: "missing_params" }, { status: 400 });
  }

  const asset = await setMenuItemAssetPrimary(menuItemId, assetId);
  if (!asset) {
    return json({ error: "asset_not_found" }, { status: 404 });
  }

  return json(asset);
}
