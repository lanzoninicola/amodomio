import { timingSafeEqual } from "node:crypto";
import { json } from "@remix-run/node";
import { env } from "@config/env";
import { enforceRateLimit, handleRouteError } from "./route-helpers.server";
import { readJsonBody } from "./security.server";
import { parseMessageCallback } from "./message-status";
import { recordMessageConfirmation } from "./message-tracking.server";

export async function handleConfirmationWebhook(
  request: Request,
  kind: "delivery" | "message-status"
) {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, { status: 405 });
  const expected = process.env.ZAPI_WEBHOOK_SECRET;
  if (!expected)
    return json({ error: "webhook_not_configured" }, { status: 503 });
  const provided =
    request.headers.get("x-zapi-webhook-secret") ||
    new URL(request.url).searchParams.get("secret") ||
    "";
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    return json({ error: "unauthorized" }, { status: 401 });
  const limit = enforceRateLimit(
    request,
    env.webhookRateLimitPerMinute,
    "zapi-confirmation"
  );
  if (limit) return limit;
  try {
    const payload = await readJsonBody(request, 256 * 1024);
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return json({ error: "invalid_payload" }, { status: 400 });
    if (payload.instanceId !== env.zapiInstanceId)
      return json({ error: "wrong_instance" }, { status: 400 });
    const parsed = parseMessageCallback(payload, kind);
    // Acknowledge inbound READ_BY_ME without treating it as an outbound receipt.
    if (
      !parsed &&
      kind === "message-status" &&
      payload.type === "MessageStatusCallback" &&
      payload.status === "READ_BY_ME"
    )
      return json({ ok: true, ignored: true });
    if (!parsed)
      return json({ error: "invalid_confirmation" }, { status: 400 });
    await recordMessageConfirmation(parsed);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
