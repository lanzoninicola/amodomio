import { normalizePhone } from "./zapi.service";
import { NormalizedWebhookEvent } from "./webhook.types";

const PHONE_KEYS = ["phone", "from", "participant", "sender", "chatid", "chat_id", "number", "remotejid"];
const MESSAGE_KEYS = [
  "text",
  "message",
  "body",
  "content",
  "caption",
  "conversation",
  "data.message",
  "data.text",
];
const MESSAGE_TYPE_KEYS = ["type", "messagetype", "typemessage"];
const INSTANCE_KEYS = ["instanceid", "instance_id"];

function coerceToString(value: any): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function walkObject(payload: any, visitor: (key: string, value: any) => string | null): string | null {
  const queue: any[] = [payload];
  while (queue.length) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }
    if (current && typeof current === "object") {
      for (const [k, v] of Object.entries(current)) {
        const found = visitor(k, v);
        if (found) return found;
        if (v && typeof v === "object") queue.push(v);
      }
    }
  }
  return null;
}

function deepFindByKeys(payload: any, keys: string[]): string | null {
  const normalizedKeys = new Set(keys.map((k) => k.toLowerCase()));
  return walkObject(payload, (key, value) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKeys.has(normalizedKey)) {
      const asString = coerceToString(value);
      if (asString) return asString;
    }
    return null;
  });
}

function extractPhone(payload: any): string | undefined {
  const rawPhone = deepFindByKeys(payload, PHONE_KEYS);
  if (!rawPhone) return undefined;
  const cleaned = rawPhone.replace(/@.+$/, "");
  const normalized = normalizePhone(cleaned);
  return normalized ?? undefined;
}

function extractMessageText(payload: any): string | undefined {
  const message = deepFindByKeys(payload, MESSAGE_KEYS);
  const trimmed = message?.trim();
  return trimmed || undefined;
}

function extractMessageType(payload: any): string | undefined {
  const messageType = deepFindByKeys(payload, MESSAGE_TYPE_KEYS);
  const trimmed = messageType?.trim();
  return trimmed || undefined;
}

function extractInstanceId(payload: any): string | undefined {
  const direct = deepFindByKeys(payload, INSTANCE_KEYS);
  if (direct?.trim()) return direct.trim();

  const instance = (payload as any)?.instance;
  if (instance && typeof instance === "object") {
    const nested = deepFindByKeys(instance, ["id", ...INSTANCE_KEYS]);
    if (nested?.trim()) return nested.trim();
  }

  return undefined;
}

export function normalizeWebhookPayload(
  event: "received" | "disconnected",
  payload: any
): NormalizedWebhookEvent {
  return {
    event,
    phone: extractPhone(payload),
    messageText: extractMessageText(payload),
    messageType: extractMessageType(payload),
    instanceId: extractInstanceId(payload),
    raw: payload,
  };
}

export function stringifyPayloadForLog(payload: any, maxBytes = 10_000) {
  try {
    const asString = JSON.stringify(payload);
    if (asString.length <= maxBytes) return asString;
    return `${asString.slice(0, maxBytes)}...<truncated>`;
  } catch {
    const fallback = String(payload);
    if (fallback.length <= maxBytes) return fallback;
    return `${fallback.slice(0, maxBytes)}...<truncated>`;
  }
}
