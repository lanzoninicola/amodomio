import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { removeSubscription } from "~/domain/push/web-push.server";

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

  const endpoint = body?.endpoint;
  if (!endpoint) {
    return json({ error: "Missing endpoint" }, { status: 400 });
  }

  try {
    const result = await removeSubscription(endpoint);
    return json({ ok: true, deleted: result.deleted ?? 0 });
  } catch (error) {
    console.error("[push] failed to remove subscription", { error, endpointTail: String(endpoint).slice(-20) });
    return json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
