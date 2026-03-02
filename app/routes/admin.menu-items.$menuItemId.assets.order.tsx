import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { listMenuItemAssetsAdmin, reorderMenuItemGalleryAssets } from "~/domain/cardapio/menu-item-assets.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "PUT") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const menuItemId = params.menuItemId;
  if (!menuItemId) {
    return json({ error: "missing_menu_item_id" }, { status: 400 });
  }

  let body: { orderedIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.orderedIds)) {
    return json({ error: "invalid_ordered_ids" }, { status: 400 });
  }

  await reorderMenuItemGalleryAssets(menuItemId, body.orderedIds);
  const assets = await listMenuItemAssetsAdmin(menuItemId);
  return json(assets);
}
