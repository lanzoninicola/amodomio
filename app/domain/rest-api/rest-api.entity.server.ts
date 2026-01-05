import { env } from "~/config/env.server";

const WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type RateLimitOptions = {
  limitPerMinute?: number;
  bucket?: string;
};

type RateLimitResult = {
  success: boolean;
  retryIn?: number;
};

function toPositiveInt(value: string | number | undefined, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("forwarded");

  if (realIp) return realIp.split(",")[0].trim();
  return "unknown";
}

function rateLimitCheck(
  request: Request,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limitPerMinute = toPositiveInt(
    options.limitPerMinute ?? process.env.VITE_REST_API_RATE_LIMIT_PER_MINUTE,
    60
  );
  const bucket = options.bucket || "rest-api";
  const key = `${bucket}:${getClientIp(request)}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true };
  }

  if (entry.count < limitPerMinute) {
    entry.count += 1;
    return { success: true };
  }

  return { success: false, retryIn: entry.resetAt - now };
}

function authorize(apiKey: string | null) {
  const secret = env.apiKey;
  console.log("rest-api.entity.server.ts - authorize fn()", { secret });
  if (!secret) {
    return { status: 500, message: "REST API secret key not configured" };
  }

  if (!apiKey) {
    return { status: 401, message: "Missing x-api-key header" };
  }

  if (apiKey !== secret) {
    return { status: 401, message: "Invalid API key" };
  }

  return { status: 200, message: "Authorized" };
}

export const restApi = {
  authorize,
  rateLimitCheck,
};
