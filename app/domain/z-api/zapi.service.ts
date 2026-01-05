import { zapiInstancePath, zapiRequest, ZApiError } from "./zapi-client.server";
import {
  ContactsResponse,
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
