import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { logPushEvent } from "~/domain/push/web-push.server";

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

  const { campaignId, subscriptionId, endpoint, type, dwellMs } = body || {};
  if (!campaignId || !type) return json({ error: "Missing campaignId or type" }, { status: 400 });

  if (!["show", "click", "close"].includes(type)) {
    return json({ error: "Invalid event type" }, { status: 400 });
  }

  await logPushEvent({ campaignId, subscriptionId, endpoint, type, dwellMs });

  return json({ ok: true });
}
