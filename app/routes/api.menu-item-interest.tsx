import { json, type ActionFunctionArgs } from "@remix-run/node";
import {
  createMenuItemInterestEvent,
  isAllowedMenuItemInterestType,
} from "~/domain/cardapio/menu-item-interest/menu-item-interest.server";

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { menuItemId: null, type: null, clientId: null };
  }

  const data = payload as Record<string, unknown>;
  return {
    menuItemId: typeof data.menuItemId === "string" ? data.menuItemId : null,
    type: typeof data.type === "string" ? data.type : null,
    clientId: typeof data.clientId === "string" ? data.clientId : null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: unknown = null;
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }
  } else {
    const formData = await request.formData();
    payload = Object.fromEntries(formData);
  }

  const { menuItemId, type, clientId } = normalizePayload(payload);

  if (!menuItemId || !type || !isAllowedMenuItemInterestType(type)) {
    return json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await createMenuItemInterestEvent({
      menuItemId,
      type,
      clientId,
    });

    return json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[api.menu-item-interest]", error);
    return json({ error: "server_error" }, { status: 500 });
  }
}
