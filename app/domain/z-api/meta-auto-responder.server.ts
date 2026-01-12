import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { stringifyPayloadForLog } from "./webhook.parser";
import { sendTrafficAutoReplyTemplate } from "./zapi.service";
import { NormalizedWebhookEvent } from "./webhook.types";

const CONTEXT = "zapi-traffic-autoresponder";

const DEFAULTS = {
  enabled: true,
  trigger: "ads",
  menuUrl: "https://amodomio.com.br/cardapio",
  textMessage:
    "Oi! Eu sou do A Modo Mio. Queremos te ajudar rapido. Segue o cardapio e infos:",
  buttonMessage:
    "Oi! Eu sou do A Modo Mio. Queremos te ajudar rapido. Escolha uma opcao abaixo:",
  menuButtonText: "Ver o nosso cardapio",
  sizesButtonText: "Informacoes sobre tamanhos",
  responseType: "text" as "text" | "buttons",
};

type TrafficAutoReplyConfig = typeof DEFAULTS;

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === "true" || value === "1" || value.toLowerCase() === "on";
}

async function loadConfig(): Promise<TrafficAutoReplyConfig> {
  try {
    const settings = await settingPrismaEntity.findAllByContext(CONTEXT);
    const byName = new Map(settings.map((s) => [s.name, s.value]));

    const triggerRaw = (byName.get("trigger") || DEFAULTS.trigger).trim();
    const trigger = triggerRaw ? triggerRaw.toLowerCase() : DEFAULTS.trigger;

    return {
      enabled: parseBoolean(byName.get("enabled"), DEFAULTS.enabled),
      trigger,
      menuUrl: byName.get("menuUrl") || DEFAULTS.menuUrl,
      textMessage: byName.get("textMessage") || byName.get("message") || DEFAULTS.textMessage,
      buttonMessage: byName.get("buttonMessage") || byName.get("message") || DEFAULTS.buttonMessage,
      menuButtonText: byName.get("menuButtonText") || DEFAULTS.menuButtonText,
      sizesButtonText:
        byName.get("sizesButtonText") || DEFAULTS.sizesButtonText,
      responseType: (byName.get("responseType") as "text" | "buttons") || DEFAULTS.responseType,
    };
  } catch (error) {
    console.warn("[z-api][traffic-config] failed to load settings, using defaults", {
      error: (error as any)?.message,
    });
    return DEFAULTS;
  }
}

function matchesTrigger(message: string | undefined, trigger: string, raw?: any) {
  if (!message) return false;
  const triggers = trigger
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (!triggers.length) return false;

  const normalized = message.toLowerCase();
  return triggers.some((t) => normalized.includes(t));
}

function matchesTriggerFromPayload(trigger: string, raw?: any) {
  if (!raw) return false;

  const triggers = trigger
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (!triggers.length) return false;

  try {
    const rawText = JSON.stringify(raw).toLowerCase();
    return triggers.some((t) => rawText.includes(t));
  } catch {
    return false;
  }
}

async function saveMetaAdsLog(params: {
  correlationId?: string;
  event?: string;
  phone?: string;
  trigger?: string;
  messageText?: string;
  sent: boolean;
  reason?: string;
  responseType?: string;
  payloadPreview?: string;
}) {
  try {
    await prismaClient.metaAdsLog.create({
      data: {
        correlationId: params.correlationId ?? null,
        event: params.event ?? null,
        phone: params.phone ?? null,
        trigger: params.trigger ?? null,
        messageText: params.messageText ?? null,
        sent: params.sent,
        reason: params.reason ?? null,
        responseType: params.responseType ?? null,
        payloadPreview: params.payloadPreview ?? null,
      },
    });
  } catch (error) {
    console.warn("[z-api][traffic] failed to save meta ads log", {
      error: (error as any)?.message,
    });
  }
}

export async function maybeSendTrafficAutoReply(
  normalized: NormalizedWebhookEvent,
  correlationId: string
): Promise<{ sent: boolean; reason?: string; response?: any; trigger?: string }> {
  const config = await loadConfig();

  if (!config.enabled) return { sent: false, reason: "disabled" };

  const triggered =
    matchesTrigger(normalized.messageText, config.trigger) ||
    matchesTriggerFromPayload(config.trigger, normalized.raw);

  if (!triggered) {
    console.info("[z-api][traffic] trigger not found", {
      correlationId,
      trigger: config.trigger,
      messageTextPreview: normalized.messageText?.slice(0, 200),
    });
    return { sent: false, reason: "trigger_not_found", trigger: config.trigger };
  }

  const payloadPreview = stringifyPayloadForLog(normalized.raw);

  if (!normalized.phone) {
    console.warn("[z-api][traffic] missing phone", { correlationId });
    await saveMetaAdsLog({
      correlationId,
      event: normalized.event,
      phone: normalized.phone,
      trigger: config.trigger,
      messageText: normalized.messageText,
      sent: false,
      reason: "phone_not_found",
      responseType: config.responseType,
      payloadPreview,
    });
    return { sent: false, reason: "phone_not_found" };
  }

  const useButtons = config.responseType === "buttons";

  const response = await sendTrafficAutoReplyTemplate(normalized.phone, {
    menuUrl: config.menuUrl,
    message: useButtons ? config.buttonMessage : config.textMessage,
    menuButtonText: config.menuButtonText,
    sizesButtonText: config.sizesButtonText,
    forceText: !useButtons,
  });

  await saveMetaAdsLog({
    correlationId,
    event: normalized.event,
    phone: normalized.phone,
    trigger: config.trigger,
    messageText: normalized.messageText,
    sent: Boolean(response),
    reason: response ? undefined : "send_failed",
    responseType: useButtons ? "buttons" : "text",
    payloadPreview,
  });

  const sent = Boolean(response);

  console.info("[z-api][traffic] sent auto-reply", {
    correlationId,
    phone: normalized.phone,
    responseType: useButtons ? "buttons" : "text",
    response,
  });

  return sent ? { sent, response } : { sent, response, reason: "send_failed" };
}

export function getTrafficAutoresponderContext() {
  return CONTEXT;
}
