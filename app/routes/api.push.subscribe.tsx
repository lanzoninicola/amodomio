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
    return json({ error: "Missing push subscription fields" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");

  await saveSubscription({
    endpoint: body.endpoint,
    expirationTime: body.expirationTime,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    userAgent,
  });

  return json({ ok: true });
}
