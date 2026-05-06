import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { listItemAssetsAdmin, reorderItemGalleryAssets } from "~/domain/item/item-assets.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "PUT") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const itemId = params.id;
  if (!itemId) {
    return json({ error: "missing_item_id" }, { status: 400 });
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

  await reorderItemGalleryAssets(itemId, body.orderedIds);
  const assets = await listItemAssetsAdmin(itemId);
  return json(assets);
}
