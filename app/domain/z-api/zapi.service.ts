import { zapiInstancePath, zapiRequest, ZApiError } from "./zapi-client.server";
import {
  ContactsResponse,
  SendButtonActionsRequest,
  SendMessageResponse,
  SendTextRequest,
  SendVideoRequest,
} from "./zapi.types";
import { ValidationError } from "./errors";

const PHONE_REGEX = /^[1-9]\d{7,14}$/;
const DEFAULT_CONTACTS_PAGE = 1;
const DEFAULT_CONTACTS_PAGE_SIZE = 20;
const AUTO_REPLY_MESSAGE = "Recebido ✅";

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!PHONE_REGEX.test(digits)) return null;
  return digits;
}

function assertPhone(phone: unknown): string {
  const normalized = normalizePhone(typeof phone === "string" ? phone : String(phone ?? ""));
  if (!normalized) throw new ValidationError("Invalid phone. Use E.164 digits without '+'.");
  return normalized;
}

function assertMessage(message: unknown): string {
  if (typeof message !== "string") throw new ValidationError("Message is required.");
  const trimmed = message.trim();
  if (!trimmed) throw new ValidationError("Message cannot be empty.");
  return trimmed;
}

function assertButtonActions(buttonActions: SendButtonActionsRequest["buttonActions"]) {
  if (!Array.isArray(buttonActions) || buttonActions.length === 0) {
    throw new ValidationError("buttonActions must be a non-empty array.");
  }

  return buttonActions.slice(0, 3).map((action, idx) => {
    const id = assertMessage(action?.id ?? `btn-${idx + 1}`);
    const text = assertMessage(action?.text ?? "");
    const url = action?.url?.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new ValidationError("Button url must use http/https.");
        }
      } catch {
        throw new ValidationError("Button url is invalid.");
      }
    }
    return { id, text, url };
  });
}

function assertVideoUrl(video: unknown): string {
  if (typeof video !== "string") throw new ValidationError("Video URL is required.");
  const trimmed = video.trim();
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new ValidationError("Video URL must use http/https.");
    }
    return url.toString();
  } catch {
    throw new ValidationError("Video URL is invalid.");
  }
}

function parseDelay(delay: unknown): number | undefined {
  if (delay === undefined || delay === null || delay === "") return undefined;
  const num = Number(delay);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError("delayMessage must be a positive number.");
  }
  return num;
}

function parseBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  throw new ValidationError(`${field} must be a boolean.`);
}

function parsePageNumber(value: unknown, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

export async function sendTextMessage(
  payload: SendTextRequest,
  options?: { timeoutMs?: number }
): Promise<SendMessageResponse> {
  const phone = assertPhone(payload?.phone);
  const message = assertMessage(payload?.message);

  return zapiRequest<SendMessageResponse>(
    "POST",
    `${zapiInstancePath}/send-text`,
    { phone, message },
    options
  );
}

export async function sendVideoMessage(
  payload: SendVideoRequest,
  options?: { timeoutMs?: number }
): Promise<SendMessageResponse> {
  const phone = assertPhone(payload?.phone);
  const video = assertVideoUrl(payload?.video);
  const delayMessage = parseDelay(payload?.delayMessage);
  const caption = payload?.caption?.trim();
  const viewOnce = parseBoolean(payload?.viewOnce, "viewOnce");

  const body: Record<string, any> = {
    phone,
    video,
  };

  if (delayMessage !== undefined) body.delayMessage = delayMessage;
  if (caption) body.caption = caption;
  if (viewOnce !== undefined) body.viewOnce = viewOnce;

  return zapiRequest<SendMessageResponse>(
    "POST",
    `${zapiInstancePath}/send-video`,
    body,
    options
  );
}

export async function sendButtonActionsMessage(
  payload: SendButtonActionsRequest,
  options?: { timeoutMs?: number }
): Promise<SendMessageResponse> {
  const phone = assertPhone(payload?.phone);
  const message = assertMessage(payload?.message);
  const buttonActions = assertButtonActions(payload?.buttonActions);
  const footerText = payload?.footerText?.trim();

  const body: Record<string, any> = { phone, message, buttonActions };
  if (footerText) body.footerText = footerText;

  return zapiRequest<SendMessageResponse>(
    "POST",
    `${zapiInstancePath}/send-button-actions`,
    body,
    options
  );
}

export async function listContacts(params: {
  page?: number | string;
  pageSize?: number | string;
}): Promise<ContactsResponse> {
  const page = parsePageNumber(params?.page, DEFAULT_CONTACTS_PAGE);
  const pageSize = parsePageNumber(params?.pageSize, DEFAULT_CONTACTS_PAGE_SIZE);

  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return zapiRequest<ContactsResponse>(
    "GET",
    `${zapiInstancePath}/contacts?${searchParams.toString()}`
  );
}

export async function sendAutoReplySafe(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  try {
    await sendTextMessage(
      { phone: normalized, message: AUTO_REPLY_MESSAGE },
      { timeoutMs: 5_000 }
    );
  } catch (error) {
    const details =
      error instanceof ZApiError
        ? { status: error.status, message: error.message }
        : { message: (error as any)?.message };
    console.warn("[z-api] auto-reply failed", { phone: normalized, ...details });
  }
}

type TrafficAutoReplyOptions = {
  menuUrl?: string;
  message?: string;
  menuButtonText?: string;
  sizesButtonText?: string;
  timeoutMs?: number;
  forceText?: boolean;
};

export async function sendTrafficAutoReplyTemplate(
  phone: string,
  params?: TrafficAutoReplyOptions
): Promise<SendMessageResponse | undefined> {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  try {
    const message =
      params?.message ??
      "Oi! Eu sou do A Modo Mio. Queremos te ajudar rapido. Escolha uma opcao abaixo:";

    const menuButtonText = params?.menuButtonText ?? "Ver o nosso cardapio";
    const sizesButtonText =
      params?.sizesButtonText ?? "Informacoes sobre tamanhos";

    if (params?.forceText) {
      return await sendTextMessage(
        {
          phone: normalized,
          message,
        },
        { timeoutMs: params?.timeoutMs ?? 10_000 }
      );
    }

    return await sendButtonActionsMessage(
      {
        phone: normalized,
        message,
        buttonActions: [
          {
            id: "VIEW_MENU",
            text: menuButtonText,
            url: params?.menuUrl,
          },
          {
            id: "INFO_SIZES",
            text: sizesButtonText,
          },
        ],
      },
      { timeoutMs: params?.timeoutMs ?? 10_000 }
    );
  } catch (error) {
    const details =
      error instanceof ZApiError
        ? { status: error.status, message: error.message, path: error.path }
        : { message: (error as any)?.message };
    console.warn("[z-api] traffic auto-reply failed", {
      phone: normalized,
      ...details,
    });
  }
}
