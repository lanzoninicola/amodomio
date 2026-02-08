import { createCookie } from "@remix-run/node";
import { randomUUID } from "crypto";
import prismaClient from "~/lib/prisma/client.server";

const RATE_LIMIT_COOKIE_NAME = "rate_limit_id";
const RATE_LIMIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const rateLimitCookie = createCookie(RATE_LIMIT_COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
  maxAge: RATE_LIMIT_COOKIE_MAX_AGE,
});

export async function getRateLimitId(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const existing = await rateLimitCookie.parse(cookieHeader);

  if (typeof existing === "string" && existing) {
    return { rateLimitId: existing, headers: null as Headers | null };
  }

  const rateLimitId = randomUUID();
  const headers = new Headers();
  headers.append("Set-Cookie", await rateLimitCookie.serialize(rateLimitId));
  return { rateLimitId, headers };
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [ip] = forwardedFor.split(",");
    return ip?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  const flyClientIp = request.headers.get("fly-client-ip");
  if (flyClientIp) return flyClientIp;

  return null;
}

export async function consumeRateLimitBucket({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const rateLimitBucket = (prismaClient as any).rateLimitBucket;
  if (!rateLimitBucket) {
    console.warn("[rate-limit] rateLimitBucket model not available in Prisma client");
    return { allowed: true, remaining: limit };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const existing = await rateLimitBucket.findUnique({
    where: { key },
  });

  if (!existing || existing.expiresAt.getTime() <= now.getTime()) {
    await rateLimitBucket.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        windowStart: now,
        expiresAt,
      },
      update: {
        count: 1,
        windowStart: now,
        expiresAt,
      },
    });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: Math.max(0, limit - (existing.count + 1)) };
}
