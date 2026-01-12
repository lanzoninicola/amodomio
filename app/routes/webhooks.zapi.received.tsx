import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { env } from "@config/env";
import { enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { PayloadTooLargeError } from "~/domain/z-api/errors";
import { readJsonBody } from "~/domain/z-api/security.server";
import { normalizeWebhookPayload, stringifyPayloadForLog } from "~/domain/z-api/webhook.parser";
import { sendAutoReplySafe } from "~/domain/z-api/zapi.service";
import { addWebhookLog } from "~/domain/z-api/webhook-log.server";
import { maybeSendTrafficAutoReply } from "~/domain/z-api/meta-auto-responder.server";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

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

function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

async function syncCrmCustomerFromWebhook(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string
) {
  if (!normalized.phone) return { skipped: "missing_phone" };

  const phone_e164 = normalize_phone_e164_br(normalized.phone);
  if (!phone_e164) return { skipped: "invalid_phone" };

  const name = normalized.contactName?.trim() || "";
  const photo = normalized.contactPhoto?.trim() || "";

  const existing = await prisma.crmCustomer.findUnique({ where: { phone_e164 } });
  let customer = existing;

  if (existing) {
    const shouldUpdateName = Boolean(name) && isBlank(existing.name);
    if (shouldUpdateName) {
      customer = await prisma.crmCustomer.update({
        where: { phone_e164 },
        data: { name },
      });
    }
  } else {
    customer = await prisma.crmCustomer.create({
      data: {
        phone_e164,
        name: name || null,
        preferred_channel: "whatsapp",
      },
    });
  }

  if (photo && customer) {
    const existingImage = await prisma.crmCustomerImage.findFirst({
      where: { customer_id: customer.id, url: photo },
      select: { id: true },
    });

    if (!existingImage) {
      await prisma.crmCustomerImage.create({
        data: {
          customer_id: customer.id,
          url: photo,
          description: "WhatsApp profile photo",
        },
      });
    }
  }

  if (customer) {
    const eventPayload = {
      action: "whatsapp_received",
      phone: normalized.phone,
      phone_e164,
      name: name || undefined,
      photo: photo || undefined,
      messageType: normalized.messageType || undefined,
      messageText: normalized.messageText || undefined,
      instanceId: normalized.instanceId || undefined,
      correlationId,
    };

    await prisma.crmCustomerEvent.create({
      data: {
        customer_id: customer.id,
        event_type: "WHATSAPP_RECEIVED",
        source: "zapi-webhook",
        external_id: correlationId,
        payload: eventPayload,
        payload_raw: JSON.stringify(eventPayload),
      },
    });
  }

  return { customerId: customer?.id, created: !existing };
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
    console.warn("[z-api][webhook][received] invalid payload", {
      correlationId,
      error: (error as any)?.message,
    });
    return json({ ok: true });
  }

  const normalized = normalizeWebhookPayload("received", payload);

  console.info("[z-api][webhook][received]", {
    correlationId,
    headers: collectHeaders(request),
    payload: stringifyPayloadForLog(payload),
    normalized: {
      phone: normalized.phone,
      messageType: normalized.messageType,
      instanceId: normalized.instanceId,
      messageTextPreview: normalized.messageText?.slice(0, 200),
      contactName: normalized.contactName,
      contactPhoto: normalized.contactPhoto,
    },
  });

  addWebhookLog({
    id: correlationId,
    event: "received",
    correlationId,
    headers: collectHeaders(request),
    payloadPreview: stringifyPayloadForLog(payload),
  });

  const crmSyncResult = await syncCrmCustomerFromWebhook(normalized, correlationId).catch((error) => {
    console.warn("[z-api][webhook][received] crm sync failed", {
      correlationId,
      error: (error as any)?.message,
    });
    return { skipped: "error" };
  });

  const trafficResult = await maybeSendTrafficAutoReply(normalized, correlationId).catch((error) => {
    console.warn("[z-api][webhook][received] traffic auto-reply failed", {
      correlationId,
      error: (error as any)?.message,
    });
    return { sent: false, reason: "error" };
  });

  // if (normalized.phone) {
  //   void sendAutoReplySafe(normalized.phone);
  // }

  return json({ ok: true, trafficResult, crmSyncResult });
}
