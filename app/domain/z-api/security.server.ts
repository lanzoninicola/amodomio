import { env } from "@config/env";
import { PayloadTooLargeError, ValidationError } from "./errors";

const WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("forwarded");

  if (realIp) return realIp.split(",")[0].trim();
  return "unknown";
}

export function checkRateLimit(request: Request, limitPerMinute: number, bucket: string) {
  const key = `${bucket}:${getClientIp(request)}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count < limitPerMinute) {
    entry.count += 1;
    return { allowed: true };
  }

  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return { allowed: false, retryAfter };
}

export function isApiKeyValid(request: Request) {
  const provided = request.headers.get("x-api-key");
  return Boolean(env.apiKey) && provided === env.apiKey;
}

export async function readJsonBody<T = any>(
  request: Request,
  maxBytes?: number
): Promise<T> {
  if (maxBytes) {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new PayloadTooLargeError();
    }
  }

  const buffer = await request.arrayBuffer();

  if (maxBytes && buffer.byteLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!buffer.byteLength) return {} as T;

  const text = new TextDecoder().decode(buffer);
  if (!text.trim()) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }
}
