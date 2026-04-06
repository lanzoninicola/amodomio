import { createHash, randomBytes } from "node:crypto";
import type {
  AccessAuditEventType,
  AccessAuditProvider,
  AdminUserAccess,
  AdminUserSession,
  AdminUserSessionStatus,
} from "@prisma/client";
import { createCookieSessionStorage } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import {
  GOOGLE_AUTH_COOKIE_SECRET,
} from "./constants.server";
import { createAccessAudit, getAuthenticatedUserProfile } from "./admin-user-access.server";
import type { AuthenticatedLoggedUser, AuthenticatedUserProfile } from "./types.server";

const SESSION_COOKIE_KEY = "admin_session_token";
const SESSION_IDLE_TIMEOUT_MS =
  Number(process.env.ADMIN_SESSION_IDLE_TIMEOUT_MINUTES || 60 * 12) * 60 * 1000;
const SESSION_ABSOLUTE_TIMEOUT_MS =
  Number(process.env.ADMIN_SESSION_ABSOLUTE_TIMEOUT_DAYS || 30) * 24 * 60 * 60 * 1000;
const SESSION_ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

const cookieSecret = GOOGLE_AUTH_COOKIE_SECRET || "AM0D0MI02O24";

const cookieOptions = {
  name: "admin_session",
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  secrets: [cookieSecret],
  secure: process.env.NODE_ENV === "production",
};

export const sessionStorage = createCookieSessionStorage({
  cookie: cookieOptions,
});

type SessionWithUser = AdminUserSession & {
  User: AdminUserAccess;
};

export async function createAdminUserSession(params: {
  request: Request;
  user: AuthenticatedUserProfile;
  authProvider: AccessAuditProvider;
}) {
  const secret = randomBytes(24).toString("hex");
  const now = new Date();
  const requestMeta = getRequestMeta(params.request);
  const sessionRecord = await prismaClient.adminUserSession.create({
    data: {
      userId: params.user.id,
      authProvider: params.authProvider,
      sessionSecretHash: hashSessionSecret(secret),
      deviceLabel: buildDeviceLabel(requestMeta.userAgent),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      lastActivityAt: now,
      idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS),
    },
  });

  const cookieSession = await sessionStorage.getSession(params.request.headers.get("Cookie"));
  cookieSession.set(SESSION_COOKIE_KEY, serializeSessionToken(sessionRecord.id, secret));

  const setCookie = await sessionStorage.commitSession(cookieSession);
  const authenticatedUser = mapAuthenticatedSession(params.user, sessionRecord);

  console.info("[auth.session.create]", {
    sessionId: sessionRecord.id,
    userId: params.user.id,
    username: params.user.username,
    authProvider: params.authProvider,
    cookieName: "admin_session",
    deviceLabel: sessionRecord.deviceLabel,
    idleExpiresAt: sessionRecord.idleExpiresAt.toISOString(),
    absoluteExpiresAt: sessionRecord.absoluteExpiresAt.toISOString(),
  });

  await createAccessAudit({
    provider: params.authProvider,
    eventType: "loginSuccess",
    success: true,
    userId: params.user.id,
    username: params.user.username,
    email: params.user.email || null,
    request: params.request,
    session: sessionRecord,
    details: { authProvider: params.authProvider },
  });

  return {
    authenticatedUser,
    setCookie,
    session: sessionRecord,
  };
}

export async function getAuthenticatedSessionFromRequest(request: Request): Promise<{
  user: AuthenticatedLoggedUser | null;
  session: SessionWithUser | null;
  destroyCookie: boolean;
}> {
  const cookieSession = await sessionStorage.getSession(request.headers.get("Cookie"));
  const token = cookieSession.get(SESSION_COOKIE_KEY) as string | undefined;

  console.info("[auth.session.read] inbound", {
    path: new URL(request.url).pathname,
    hasCookieHeader: Boolean(request.headers.get("Cookie")),
    hasSessionToken: Boolean(token),
  });

  if (!token) {
    return { user: null, session: null, destroyCookie: false };
  }

  const parsed = parseSessionToken(token);
  if (!parsed) {
    console.warn("[auth.session.read] invalid-token-format", {
      path: new URL(request.url).pathname,
    });
    return { user: null, session: null, destroyCookie: true };
  }

  const session = await prismaClient.adminUserSession.findUnique({
    where: { id: parsed.sessionId },
    include: { User: true },
  });

  if (!session) {
    console.warn("[auth.session.read] session-not-found", {
      path: new URL(request.url).pathname,
      sessionId: parsed.sessionId,
    });
    return { user: null, session: null, destroyCookie: true };
  }

  if (session.sessionSecretHash !== hashSessionSecret(parsed.secret)) {
    console.warn("[auth.session.read] session-secret-mismatch", {
      path: new URL(request.url).pathname,
      sessionId: parsed.sessionId,
    });
    return { user: null, session: null, destroyCookie: true };
  }

  if (!session.User?.isActive) {
    console.warn("[auth.session.read] inactive-user", {
      path: new URL(request.url).pathname,
      sessionId: session.id,
      userId: session.userId,
    });
    await expireOrRevokeSession({
      session,
      eventType: "sessionRevoked",
      reason: "inactive-user",
      request,
    });
    return { user: null, session: null, destroyCookie: true };
  }

  if (session.status !== "active") {
    console.warn("[auth.session.read] inactive-session-status", {
      path: new URL(request.url).pathname,
      sessionId: session.id,
      status: session.status,
    });
    return { user: null, session, destroyCookie: true };
  }

  const now = Date.now();
  if (
    now > session.idleExpiresAt.getTime() ||
    now > session.absoluteExpiresAt.getTime()
  ) {
    console.warn("[auth.session.read] expired", {
      path: new URL(request.url).pathname,
      sessionId: session.id,
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    });
    await expireOrRevokeSession({
      session,
      eventType: "sessionExpired",
      reason:
        now > session.absoluteExpiresAt.getTime()
          ? "absolute-timeout"
          : "idle-timeout",
      nextStatus: "expired",
      request,
    });

    return { user: null, session: null, destroyCookie: true };
  }

  const nextSession =
    now - session.lastActivityAt.getTime() >= SESSION_ACTIVITY_REFRESH_MS
      ? await prismaClient.adminUserSession.update({
          where: { id: session.id },
          data: {
            lastActivityAt: new Date(now),
            idleExpiresAt: new Date(now + SESSION_IDLE_TIMEOUT_MS),
            ipAddress: getRequestMeta(request).ipAddress,
            userAgent: getRequestMeta(request).userAgent,
            deviceLabel: buildDeviceLabel(getRequestMeta(request).userAgent),
          },
          include: { User: true },
        })
      : session;

  const userProfile = getAuthenticatedUserProfile(nextSession.User, nextSession.authProvider);

  console.info("[auth.session.read] authorized", {
    path: new URL(request.url).pathname,
    sessionId: nextSession.id,
    userId: nextSession.userId,
    username: nextSession.User.username,
    status: nextSession.status,
  });

  return {
    user: mapAuthenticatedSession(userProfile, nextSession),
    session: nextSession,
    destroyCookie: false,
  };
}

export async function destroySessionCookie(request: Request) {
  const cookieSession = await sessionStorage.getSession(request.headers.get("Cookie"));
  cookieSession.unset(SESSION_COOKIE_KEY);
  return sessionStorage.destroySession(cookieSession);
}

export async function revokeCurrentAdminSession(params: {
  request: Request;
  actorUserId?: string | null;
}) {
  const current = await getAuthenticatedSessionFromRequest(params.request);

  if (current.session?.status === "active") {
    await expireOrRevokeSession({
      session: current.session,
      eventType: "logout",
      reason: "logout",
      actorUserId: params.actorUserId || current.session.userId,
      request: params.request,
      nextStatus: "revoked",
    });
  }

  return destroySessionCookie(params.request);
}

export async function revokeAdminSessionById(params: {
  sessionId: string;
  actorUserId: string;
  request: Request;
  reason?: string;
}) {
  const session = await prismaClient.adminUserSession.findUnique({
    where: { id: params.sessionId },
    include: { User: true },
  });

  if (!session) return null;

  if (session.status === "active") {
    await expireOrRevokeSession({
      session,
      eventType: "sessionRevoked",
      reason: params.reason || "manual-revoke",
      actorUserId: params.actorUserId,
      request: params.request,
      nextStatus: "revoked",
    });
  }

  return session;
}

export async function blockAdminSessionById(params: {
  sessionId: string;
  actorUserId: string;
  request: Request;
  reason?: string;
}) {
  const session = await prismaClient.adminUserSession.findUnique({
    where: { id: params.sessionId },
    include: { User: true },
  });

  if (!session) return null;

  if (session.status === "active") {
    await expireOrRevokeSession({
      session,
      eventType: "sessionBlocked",
      reason: params.reason || "manual-block",
      actorUserId: params.actorUserId,
      request: params.request,
      nextStatus: "blocked",
    });
  }

  return session;
}

export async function revokeAllAdminSessionsForUser(params: {
  userId: string;
  actorUserId: string;
  request: Request;
  exceptSessionId?: string | null;
}) {
  const activeSessions = await prismaClient.adminUserSession.findMany({
    where: {
      userId: params.userId,
      status: "active",
      ...(params.exceptSessionId ? { id: { not: params.exceptSessionId } } : {}),
    },
    include: { User: true },
  });

  if (!activeSessions.length) {
    return { count: 0 };
  }

  await prismaClient.adminUserSession.updateMany({
    where: {
      id: { in: activeSessions.map((session) => session.id) },
    },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: "logout-all-devices",
      revokedByUserId: params.actorUserId,
    },
  });

  for (const session of activeSessions) {
    await createAccessAudit({
      provider: session.authProvider,
      eventType: "logoutAllDevices",
      success: true,
      userId: session.userId,
      actorUserId: params.actorUserId,
      username: session.User.username,
      email: session.User.email,
      request: params.request,
      session,
      details: {
        reason: "logout-all-devices",
        exceptSessionId: params.exceptSessionId || null,
      },
    });
  }

  return { count: activeSessions.length };
}

export async function listAdminSessions() {
  return prismaClient.adminUserSession.findMany({
    include: { User: true },
    orderBy: [{ lastActivityAt: "desc" }],
    take: 200,
  });
}

export function getCurrentSessionId(user: Pick<AuthenticatedLoggedUser, "sessionId">) {
  return user.sessionId;
}

function mapAuthenticatedSession(
  user: AuthenticatedUserProfile,
  session: AdminUserSession
): AuthenticatedLoggedUser {
  return {
    ...user,
    sessionId: session.id,
    sessionStatus: session.status,
    sessionDeviceLabel: session.deviceLabel || null,
    sessionLastActivityAt: session.lastActivityAt,
    sessionIdleExpiresAt: session.idleExpiresAt,
    sessionAbsoluteExpiresAt: session.absoluteExpiresAt,
  };
}

async function expireOrRevokeSession(params: {
  session: SessionWithUser;
  eventType: AccessAuditEventType;
  reason: string;
  request: Request;
  actorUserId?: string | null;
  nextStatus?: AdminUserSessionStatus;
}) {
  const nextStatus = params.nextStatus || "revoked";
  const updated = await prismaClient.adminUserSession.update({
    where: { id: params.session.id },
    data: {
      status: nextStatus,
      revokedAt: new Date(),
      revokedReason: params.reason,
      revokedByUserId: params.actorUserId || null,
    },
  });

  await createAccessAudit({
    provider: params.session.authProvider,
    eventType: params.eventType,
    success: true,
    userId: params.session.userId,
    actorUserId: params.actorUserId || null,
    username: params.session.User.username,
    email: params.session.User.email,
    request: params.request,
    session: updated,
    details: { reason: params.reason, status: nextStatus },
  });
}

function serializeSessionToken(sessionId: string, secret: string) {
  return `${sessionId}.${secret}`;
}

function parseSessionToken(token: string) {
  const [sessionId, secret] = String(token || "").split(".");
  if (!sessionId || !secret) return null;
  return { sessionId, secret };
}

function hashSessionSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function buildDeviceLabel(userAgent?: string | null) {
  const value = String(userAgent || "").trim();
  if (!value) return "Dispositivo desconhecido";
  return value.slice(0, 120);
}

function getRequestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || realIp || null,
    userAgent: request.headers.get("user-agent"),
  };
}
