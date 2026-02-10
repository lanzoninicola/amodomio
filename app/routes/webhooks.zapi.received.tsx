import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { env } from "@config/env";
import { enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { PayloadTooLargeError } from "~/domain/z-api/errors";
import { readJsonBody } from "~/domain/z-api/security.server";
import { normalizeWebhookPayload, stringifyPayloadForLog } from "~/domain/z-api/webhook.parser";
import { sendTextMessage, sendVideoMessage } from "~/domain/z-api/zapi.service";
import { addWebhookLog } from "~/domain/z-api/webhook-log.server";
import { maybeSendTrafficAutoReply } from "~/domain/z-api/meta-auto-responder.server";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { getOffHoursAutoresponderConfig, getStoreOpeningStatus } from "~/domain/store-opening/store-opening-status.server";

const WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024;
const LOG_HEADERS = ["user-agent", "x-forwarded-for", "cf-connecting-ip", "x-real-ip", "content-type"];
const CRM_SYNC_TTL_MS = 15 * 60 * 1000;
const ECHO_SENT_WINDOW_MS = 5 * 60 * 1000;
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

function normalizeComparableMessageText(value: string | undefined | null) {
  if (!value) return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function isOutboundEchoMessage(
  customerId: string,
  messageText: string | undefined | null
) {
  const normalizedIncoming = normalizeComparableMessageText(messageText);
  if (!normalizedIncoming) return false;

  const since = new Date(Date.now() - ECHO_SENT_WINDOW_MS);
  const recentSentEvents = await prisma.crmCustomerEvent.findMany({
    where: {
      customer_id: customerId,
      event_type: "WHATSAPP_SENT",
      created_at: { gte: since },
    },
    orderBy: { created_at: "desc" },
    take: 20,
    select: { payload: true, payload_raw: true },
  });

  for (const event of recentSentEvents) {
    const payloadMessage = normalizeComparableMessageText(
      (event.payload as any)?.messageText
    );
    if (payloadMessage && payloadMessage === normalizedIncoming) {
      return true;
    }

    if (event.payload_raw) {
      try {
        const parsed = JSON.parse(event.payload_raw);
        const rawMessage = normalizeComparableMessageText(parsed?.messageText);
        if (rawMessage && rawMessage === normalizedIncoming) {
          return true;
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  return false;
}

async function syncCrmCustomerFromWebhook(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string
) {
  if (!normalized.phone) return { skipped: "missing_phone" };

  const phone_e164 = normalize_phone_e164_br(normalized.phone);
  if (!phone_e164) return { skipped: "invalid_phone" };
  const shouldSkipProfileSync = shouldSkipCrmSync(phone_e164);

  const name = normalized.contactName?.trim() || "";
  const photo = normalized.contactPhoto?.trim() || "";

  const existing = await prisma.crmCustomer.findUnique({ where: { phone_e164 } });
  let customer = existing;

  if (existing) {
    const shouldUpdateName = Boolean(name) && isBlank(existing.name);
    if (!shouldSkipProfileSync && shouldUpdateName) {
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

  if (!shouldSkipProfileSync && photo && customer) {
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
    const isOutboundEcho = await isOutboundEchoMessage(customer.id, normalized.messageText);
    const isSentByAttendant = normalized.fromMe === true || isOutboundEcho;
    const eventPayload = {
      action: isSentByAttendant ? "whatsapp_sent" : "whatsapp_received",
      phone: normalized.phone,
      phone_e164,
      name: name || undefined,
      photo: photo || undefined,
      fromMe: normalized.fromMe,
      fromEcho: isOutboundEcho || undefined,
      messageType: normalized.messageType || undefined,
      messageText: normalized.messageText || undefined,
      instanceId: normalized.instanceId || undefined,
      correlationId,
    };

    await prisma.crmCustomerEvent.create({
      data: {
        customer_id: customer.id,
        event_type: isSentByAttendant ? "WHATSAPP_SENT" : "WHATSAPP_RECEIVED",
        source: "zapi-webhook",
        external_id: correlationId,
        payload: eventPayload,
        payload_raw: JSON.stringify(eventPayload),
      },
    });
  }

  return { customerId: customer?.id, created: !existing, skippedProfileSync: shouldSkipProfileSync };
}

async function registerAutoReplySentEvent(
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  correlationId: string,
  channel: "traffic" | "off-hours",
  messageText?: string
) {
  if (!normalized.phone) return;

  const phone_e164 = normalize_phone_e164_br(normalized.phone);
  if (!phone_e164) return;

  const customer = await prisma.crmCustomer.findUnique({
    where: { phone_e164 },
    select: { id: true },
  });
  if (!customer) return;

  const payload = {
    action: "whatsapp_sent",
    channel,
    phone: normalized.phone,
    phone_e164,
    fromMe: true,
    messageText: messageText?.trim() || undefined,
    correlationId,
  };

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customer.id,
      event_type: "WHATSAPP_SENT",
      source: "zapi-auto-reply",
      external_id: `${correlationId}:${channel}`,
      payload,
      payload_raw: JSON.stringify(payload),
    },
  });
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

  if (normalized.fromMe === true) {
    return json({ ok: true, trafficResult: { sent: false, reason: "from_me" }, offHoursResult: { sent: false, reason: "from_me" }, crmSyncResult });
  }

  const trafficResult = await maybeSendTrafficAutoReply(normalized, correlationId).catch((error) => {
    console.warn("[z-api][webhook][received] traffic auto-reply failed", {
      correlationId,
      error: (error as any)?.message,
    });
    return { sent: false, reason: "error" };
  });
  if (trafficResult.sent) {
    await registerAutoReplySentEvent(normalized, correlationId, "traffic").catch((error) => {
      console.warn("[z-api][webhook][received] traffic sent event failed", {
        correlationId,
        error: (error as any)?.message,
      });
    });
  }

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
    const response = await sendVideoMessage(
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
    if (response) {
      await registerAutoReplySentEvent(
        normalized,
        correlationId,
        "off-hours",
        offHoursConfig.caption
      ).catch((error) => {
        console.warn("[z-api][off-hours] register sent event failed", {
          correlationId,
          error: (error as any)?.message,
        });
      });
    }
    return response;
  }

  const message = offHoursConfig.message?.trim();
  if (!message) return undefined;

  const response = await sendTextMessage(
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
  if (response) {
    await registerAutoReplySentEvent(normalized, correlationId, "off-hours", message).catch((error) => {
      console.warn("[z-api][off-hours] register sent event failed", {
        correlationId,
        error: (error as any)?.message,
      });
    });
  }
  return response;
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
