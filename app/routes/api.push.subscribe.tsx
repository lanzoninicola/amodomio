import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { saveSubscription } from "~/domain/push/web-push.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    console.error("[push] subscribe missing fields", { hasEndpoint: !!body?.endpoint, hasKeys: !!body?.keys });
    return json({ error: "Missing push subscription fields" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");

  try {
    await saveSubscription({
      endpoint: body.endpoint,
      expirationTime: body.expirationTime,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      userAgent,
    });
    console.info("[push] subscription stored", {
      ua: userAgent,
      endpointTail: body.endpoint?.slice(-20),
    });
  } catch (error) {
    console.error("[push] failed to save subscription", { error, ua: userAgent });
    return json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return json({ ok: true });
}
