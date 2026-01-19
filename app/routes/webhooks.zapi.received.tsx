import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { env } from "@config/env";
import { enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { PayloadTooLargeError } from "~/domain/z-api/errors";
import { readJsonBody } from "~/domain/z-api/security.server";
import { normalizeWebhookPayload, stringifyPayloadForLog } from "~/domain/z-api/webhook.parser";
import { sendAutoReplySafe, sendTextMessage, sendVideoMessage } from "~/domain/z-api/zapi.service";
import { addWebhookLog } from "~/domain/z-api/webhook-log.server";
import { maybeSendTrafficAutoReply } from "~/domain/z-api/meta-auto-responder.server";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { getOffHoursAutoresponderConfig, getStoreOpeningStatus } from "~/domain/store-opening/store-opening-status.server";

const WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024;
const LOG_HEADERS = ["user-agent", "x-forwarded-for", "cf-connecting-ip", "x-real-ip", "content-type"];
const CRM_SYNC_TTL_MS = 15 * 60 * 1000;
const crmSyncCache = new Map<string, number>();
const offHoursReplyCache = new Map<string, number>();
const offHoursAggregationQueue = new Map<string, NodeJS.Timeout>();

function shouldSkipCrmSync(phoneE164: string) {
  const now = Date.now();
  const cachedAt = crmSyncCache.get(phoneE164);
  if (cachedAt && now - cachedAt < CRM_SYNC_TTL_MS) return true;

  if (crmSyncCache.size > 5000) {
    for (const [key, timestamp] of crmSyncCache) {
      if (now - timestamp >= CRM_SYNC_TTL_MS) {
        crmSyncCache.delete(key);
      }
    }
  }

  crmSyncCache.set(phoneE164, now);
  return false;
}

function shouldSkipOffHoursReply(phone: string, ttlMs: number) {
  const now = Date.now();
  const cachedAt = offHoursReplyCache.get(phone);
  if (cachedAt && now - cachedAt < ttlMs) return true;

  if (offHoursReplyCache.size > 5000) {
    for (const [key, timestamp] of offHoursReplyCache) {
      if (now - timestamp >= ttlMs) {
        offHoursReplyCache.delete(key);
      }
    }
  }

  offHoursReplyCache.set(phone, now);
  return false;
}

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

function toWhatsappFormatting(value: string) {
  if (!value) return "";
  let text = value;
  text = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
  text = text.replace(/__(.+?)__/g, "_$1_");
  text = text.replace(/_(.+?)_/g, "_$1_");
  text = text.replace(/```([\s\S]+?)```/g, "$1");
  text = text.replace(/`(.+?)`/g, "$1");
  return text;
}

async function syncCrmCustomerFromWebhook(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string
) {
  if (!normalized.phone) return { skipped: "missing_phone" };

  const phone_e164 = normalize_phone_e164_br(normalized.phone);
  if (!phone_e164) return { skipped: "invalid_phone" };
  if (shouldSkipCrmSync(phone_e164)) return { skipped: "cache_hit" };

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

  // console.info("[z-api][webhook][received]", {
  //   correlationId,
  //   headers: collectHeaders(request),
  //   payload: stringifyPayloadForLog(payload),
  //   normalized: {
  //     phone: normalized.phone,
  //     messageType: normalized.messageType,
  //     instanceId: normalized.instanceId,
  //     messageTextPreview: normalized.messageText?.slice(0, 200),
  //     contactName: normalized.contactName,
  //     contactPhoto: normalized.contactPhoto,
  //   },
  // });

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

  const offHoursResult = await maybeSendOffHoursAutoReply(normalized, correlationId, trafficResult.sent).catch((error) => {
    console.warn("[z-api][webhook][received] off-hours auto-reply failed", {
      correlationId,
      error: (error as any)?.message,
    });
    return { sent: false, reason: "error" };
  });

  // if (normalized.phone) {
  //   void sendAutoReplySafe(normalized.phone);
  // }

  return json({ ok: true, trafficResult, offHoursResult, crmSyncResult });
}

async function maybeSendOffHoursAutoReply(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string,
  alreadyReplied: boolean
) {
  if (alreadyReplied) return { sent: false, reason: "already_replied" };
  if (!normalized.phone) return { sent: false, reason: "missing_phone" };

  const [storeStatus, offHoursConfig] = await Promise.all([
    getStoreOpeningStatus(),
    getOffHoursAutoresponderConfig(),
  ]);

  if (!offHoursConfig.enabled) return { sent: false, reason: "disabled" };
  if (storeStatus.status.isOpen) return { sent: false, reason: "store_open" };
  const aggregationSeconds = Math.max(0, offHoursConfig.aggregationSeconds ?? 0);
  if (aggregationSeconds > 0) {
    scheduleOffHoursAutoReply(normalized, correlationId, aggregationSeconds);
    return { sent: false, reason: "scheduled" };
  }

  const response = await sendOffHoursAutoReply(normalized, correlationId, offHoursConfig);
  return { sent: Boolean(response), reason: response ? undefined : "send_failed" };
}

async function sendOffHoursAutoReply(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string,
  offHoursConfig: Awaited<ReturnType<typeof getOffHoursAutoresponderConfig>>
) {
  const storeStatus = await getStoreOpeningStatus();
  if (storeStatus.status.isOpen) return undefined;

  const ttlMs = Math.max(1, offHoursConfig.cooldownMinutes) * 60 * 1000;
  if (shouldSkipOffHoursReply(normalized.phone, ttlMs)) {
    return undefined;
  }

  const responseType = offHoursConfig.responseType ?? "text";
  if (responseType === "video") {
    const video = offHoursConfig.video?.trim();
    if (!video) return undefined;

    return await sendVideoMessage(
      {
        phone: normalized.phone,
        video,
        caption: offHoursConfig.caption
          ? toWhatsappFormatting(offHoursConfig.caption.trim())
          : undefined,
      },
      { timeoutMs: 10_000 }
    ).catch((error) => {
      console.warn("[z-api][off-hours] send video failed", {
        correlationId,
        error: (error as any)?.message,
      });
      return undefined;
    });
  }

  const message = offHoursConfig.message?.trim();
  if (!message) return undefined;

  return await sendTextMessage(
    {
      phone: normalized.phone,
      message,
    },
    { timeoutMs: 10_000 }
  ).catch((error) => {
    console.warn("[z-api][off-hours] send text failed", {
      correlationId,
      error: (error as any)?.message,
    });
    return undefined;
  });
}

function scheduleOffHoursAutoReply(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string,
  aggregationSeconds: number
) {
  const key = normalized.phone;
  if (!key) return;

  const existing = offHoursAggregationQueue.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    offHoursAggregationQueue.delete(key);
    const offHoursConfig = await getOffHoursAutoresponderConfig();
    await sendOffHoursAutoReply(normalized, correlationId, offHoursConfig);
  }, aggregationSeconds * 1000);

  offHoursAggregationQueue.set(key, timer);
}
