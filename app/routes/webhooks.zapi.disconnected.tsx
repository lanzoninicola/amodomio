import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { env } from "@config/env";
import { enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { PayloadTooLargeError } from "~/domain/z-api/errors";
import { readJsonBody } from "~/domain/z-api/security.server";
import { normalizeWebhookPayload, stringifyPayloadForLog } from "~/domain/z-api/webhook.parser";

const WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024;
const LOG_HEADERS = ["user-agent", "x-forwarded-for", "cf-connecting-ip", "x-real-ip", "content-type"];

function collectHeaders(request: Request) {
  const headers: Record<string, string> = {};
  for (const header of LOG_HEADERS) {
    const value = request.headers.get(header);
    if (value) headers[header] = value;
  }
  return headers;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(
    request,
    env.webhookRateLimitPerMinute,
    "zapi-webhook"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const correlationId = uuidv4();
  let payload: any = {};

  try {
    payload = await readJsonBody(request, WEBHOOK_BODY_LIMIT_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return handleRouteError(error);
    }
    console.warn("[z-api][webhook][disconnected] invalid payload", {
      correlationId,
      error: (error as any)?.message,
    });
    return json({ ok: true });
  }

  const normalized = normalizeWebhookPayload("disconnected", payload);

  console.info("[z-api][webhook][disconnected]", {
    correlationId,
    headers: collectHeaders(request),
    payload: stringifyPayloadForLog(payload),
    normalized,
  });

  return json({ ok: true });
}
