import { consumeRateLimitBucket, getClientIp, getRateLimitId } from "./rate-limit.server";

const WINDOW_MS = 1000 * 60 * 60 * 24;
const PER_ITEM_LIMIT = 1;
const PER_IP_COOKIE_LIMIT = 20;
const PER_IP_LIMIT = 120;

export async function buildLikeRateLimitContext(request: Request) {
  const { rateLimitId, headers } = await getRateLimitId(request);
  const ip = getClientIp(request);
  return { rateLimitId, ip, headers };
}

export async function consumeLikeRateLimit({
  menuItemId,
  rateLimitId,
  ip,
}: {
  menuItemId: string;
  rateLimitId: string;
  ip: string | null;
}) {
  const ipKey = ip ?? "unknown";

  const perItemKey = `like:item:${menuItemId}:ip:${ipKey}:rid:${rateLimitId}`;
  const perIpCookieKey = `like:iprid:${ipKey}:rid:${rateLimitId}`;
  const perIpKey = ip ? `like:ip:${ip}` : null;

  const itemResult = await consumeRateLimitBucket({
    key: perItemKey,
    limit: PER_ITEM_LIMIT,
    windowMs: WINDOW_MS,
  });

  if (!itemResult.allowed) {
    return { allowed: false };
  }

  const ipCookieResult = await consumeRateLimitBucket({
    key: perIpCookieKey,
    limit: PER_IP_COOKIE_LIMIT,
    windowMs: WINDOW_MS,
  });

  if (!ipCookieResult.allowed) {
    return { allowed: false };
  }

  if (perIpKey) {
    const ipResult = await consumeRateLimitBucket({
      key: perIpKey,
      limit: PER_IP_LIMIT,
      windowMs: WINDOW_MS,
    });

    if (!ipResult.allowed) {
      return { allowed: false };
    }
  }

  return { allowed: true };
}
