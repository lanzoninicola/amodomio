import prismaClient from "~/lib/prisma/client.server";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";
import { normalizePhone, sendTextMessage } from "~/domain/z-api/zapi.service";
import { redisGetString, redisSetStringEx } from "~/lib/cache/redis.server";

const CONTEXT = "cardapio";
const ALERT_ENABLED_SETTING = "contingencia.whatsapp-alert.enabled";
const ALERT_PHONES_SETTING = "contingencia.whatsapp-alert.phones";
const ALERT_COOLDOWN_SECONDS_SETTING = "contingencia.whatsapp-alert.cooldown-seconds";
const ALERT_MESSAGE_SETTING = "contingencia.whatsapp-alert.message";
const ALERT_COOLDOWN_CACHE_KEY = "cardapio:contingencia:wpp-alert:cooldown:v1";
const DEFAULT_COOLDOWN_SECONDS = 300;

function parseCooldownSeconds(value: string | null | undefined): number {
  if (!value) return DEFAULT_COOLDOWN_SECONDS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COOLDOWN_SECONDS;
  return Math.max(1, Math.floor(parsed));
}

function parsePhones(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = value
    .split(/[\n,;]+/g)
    .map((entry) => normalizePhone(entry))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(normalized));
}

function buildDefaultMessage(params: { url: string; errorMessage: string }) {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return [
    "ALERTA DE CONTINGENCIA DO CARDAPIO",
    `Horario: ${now}`,
    `URL: ${params.url}`,
    `Erro: ${params.errorMessage}`,
  ].join("\n");
}

export async function notifyCardapioContingencyByWhatsapp(input: {
  requestUrl: string;
  error: unknown;
  ignoreCooldown?: boolean;
}) {
  try {
    const settings = await prismaClient.setting.findMany({
      where: {
        context: CONTEXT,
        name: {
          in: [
            ALERT_ENABLED_SETTING,
            ALERT_PHONES_SETTING,
            ALERT_COOLDOWN_SECONDS_SETTING,
            ALERT_MESSAGE_SETTING,
          ],
        },
      },
      select: { name: true, value: true },
      orderBy: [{ createdAt: "desc" }],
    });

    const map = settings.reduce<Record<string, string | null>>((acc, setting) => {
      if (acc[setting.name] !== undefined) return acc;
      acc[setting.name] = setting.value;
      return acc;
    }, {});

    const enabled = parseBooleanSetting(map[ALERT_ENABLED_SETTING], false);
    if (!enabled) return;

    const phones = parsePhones(map[ALERT_PHONES_SETTING]);
    if (phones.length === 0) return;

    const cooldownSeconds = parseCooldownSeconds(map[ALERT_COOLDOWN_SECONDS_SETTING]);
    if (!input.ignoreCooldown) {
      const cooldown = await redisGetString(ALERT_COOLDOWN_CACHE_KEY);
      if (cooldown) return;
    }

    const errorMessage =
      input.error instanceof Error
        ? input.error.message
        : String(input.error ?? "unknown");

    const message =
      map[ALERT_MESSAGE_SETTING]?.trim() ||
      buildDefaultMessage({
        url: input.requestUrl,
        errorMessage,
      });

    const sendResults = await Promise.allSettled(
      phones.map((phone) => sendTextMessage({ phone, message }, { timeoutMs: 10_000 }))
    );

    const successCount = sendResults.filter((result) => result.status === "fulfilled").length;
    if (successCount > 0 && !input.ignoreCooldown) {
      await redisSetStringEx(
        ALERT_COOLDOWN_CACHE_KEY,
        `${Date.now()}`,
        cooldownSeconds
      );
    }

    if (successCount !== phones.length) {
      console.warn("[cardapio] contingencia whatsapp alert partially failed", {
        successCount,
        total: phones.length,
      });
    }
  } catch (error) {
    console.error("[cardapio] contingencia whatsapp alert failed", error);
  }
}
