import type {
  AuditProvider,
  UserAccess,
  UserRole,
  UserSession,
} from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./password.server";
import type { AuthenticatedUserProfile } from "./types.server";

const TEMPORARY_PASSWORD_WINDOW_MS = 30 * 60 * 1000;
const ROLE_INHERITANCE: Record<UserRole, UserRole[]> = {
  user: ["user"],
  admin: ["admin", "user"],
  superAdmin: ["superAdmin", "admin", "user"],
};

export function normalizeUserEmail(email?: string | null) {
  const value = String(email || "").trim().toLowerCase();
  return value || null;
}

export function normalizeUsername(username?: string | null) {
  const value = String(username || "").trim().toLowerCase();
  return value || null;
}

export function getLegacyWhitelistedEmails() {
  return String(process.env.GOOGLE_AUTH_EMAIL_WHITELIST || "")
    .split(",")
    .map((email) => normalizeUserEmail(email))
    .filter((email): email is string => Boolean(email));
}

export async function getAuthenticatedUserFromId(userId?: string | null) {
  if (!userId) return null;

  const user = await prismaClient.userAccess.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) return null;

  return getAuthenticatedUserProfile(user, "system");
}

export function normalizeUserRoles(roles?: UserRole[] | null) {
  const normalized = Array.from(new Set((roles || []).filter(Boolean))) as UserRole[];

  return normalized.length ? normalized : ["user"];
}

export function getEffectiveRoles(user: { roles: UserRole[] }) {
  return Array.from(
    new Set(
      normalizeUserRoles(user.roles).flatMap((role) => ROLE_INHERITANCE[role] || [role])
    )
  );
}

export function hasAnyRole(
  user: { roles: UserRole[] },
  roles: UserRole[]
) {
  const effectiveRoles = getEffectiveRoles(user);
  return roles.some((role) => effectiveRoles.includes(role));
}

export async function authenticatePasswordLogin(params: {
  identifier: string;
  password: string;
  request: Request;
}) {
  const identifier = String(params.identifier || "").trim();
  const password = String(params.password || "");
  const normalizedUsername = normalizeUsername(identifier);
  const normalizedEmail = normalizeUserEmail(identifier);
  const whereClauses = [
    normalizedUsername ? { username: normalizedUsername } : null,
    normalizedEmail ? { email: normalizedEmail } : null,
  ].filter(Boolean) as Array<{ username?: string; email?: string }>;

  if (whereClauses.length === 0) {
    return null;
  }

  const user = await prismaClient.userAccess.findFirst({
    where: { OR: whereClauses as any },
  });

  if (!user) {
    await createAccessAudit({
      provider: "password",
      eventType: "loginFailure",
      success: false,
      username: normalizedUsername,
      email: normalizedEmail,
      request: params.request,
      details: { reason: "user-not-found" },
    });
    return null;
  }

  if (!user.isActive || !user.allowPasswordLogin) {
    await createAccessAudit({
      provider: "password",
      eventType: "loginFailure",
      success: false,
      user,
      request: params.request,
      details: { reason: !user.isActive ? "inactive-user" : "password-login-disabled" },
    });
    return null;
  }

  const matchesPermanent = await verifyPassword(password, user.passwordHash);
  const temporaryStillValid =
    Boolean(user.temporaryPasswordHash) &&
    Boolean(user.temporaryPasswordExpiresAt) &&
    user.temporaryPasswordExpiresAt!.getTime() > Date.now();
  const matchesTemporary = temporaryStillValid
    ? await verifyPassword(password, user.temporaryPasswordHash)
    : false;

  if (!matchesPermanent && !matchesTemporary) {
    await createAccessAudit({
      provider: "password",
      eventType: "loginFailure",
      success: false,
      user,
      request: params.request,
      details: {
        reason: temporaryStillValid ? "invalid-password" : "invalid-or-expired-password",
      },
    });
    return null;
  }

  const nextData: Partial<UserAccess> & Record<string, any> = {
    lastLoginAt: new Date(),
    lastPasswordLoginAt: new Date(),
  };

  if (matchesTemporary && user.temporaryPasswordHash) {
    nextData.passwordHash = user.temporaryPasswordHash;
    nextData.passwordUpdatedAt = new Date();
    nextData.temporaryPasswordHash = null;
    nextData.temporaryPasswordExpiresAt = null;
    nextData.temporaryPasswordSentAt = null;
  }

  const updated = await prismaClient.userAccess.update({
    where: { id: user.id },
    data: nextData,
  });

  return getAuthenticatedUserProfile(updated, "password");
}

export async function issueTemporaryPassword(params: {
  username: string;
  request: Request;
}) {
  const username = normalizeUsername(params.username);
  if (!username) {
    return {
      ok: false as const,
      message: "Informe o username para recuperar a senha.",
    };
  }

  const user = await prismaClient.userAccess.findUnique({
    where: { username },
  });

  if (!user) {
    await createAccessAudit({
      provider: "password",
      eventType: "passwordResetFailed",
      success: false,
      username,
      request: params.request,
      details: { reason: "user-not-found" },
    });

    return {
      ok: false as const,
      message: "Usuário não encontrado.",
    };
  }

  if (!user.isActive || !user.allowPasswordLogin) {
    await createAccessAudit({
      provider: "password",
      eventType: "passwordResetFailed",
      success: false,
      user,
      request: params.request,
      details: { reason: !user.isActive ? "inactive-user" : "password-login-disabled" },
    });

    return {
      ok: false as const,
      message: "Este usuário não está habilitado para acesso por senha.",
    };
  }

  const normalizedPhone = normalizePhone(user.mobilePhone);
  if (!normalizedPhone) {
    await createAccessAudit({
      provider: "password",
      eventType: "passwordResetFailed",
      success: false,
      user,
      request: params.request,
      details: { reason: "missing-mobile-phone" },
    });

    return {
      ok: false as const,
      message: "Este usuário não possui celular cadastrado para recuperação por WhatsApp.",
    };
  }

  await createAccessAudit({
    provider: "password",
    eventType: "passwordResetRequested",
    success: true,
    user,
    request: params.request,
  });

  const temporaryPassword = generateTemporaryPassword();
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_WINDOW_MS);
  const temporaryPasswordHash = await hashPassword(temporaryPassword);

  const updated = await prismaClient.userAccess.update({
    where: { id: user.id },
    data: {
      temporaryPasswordHash,
      temporaryPasswordExpiresAt: expiresAt,
      temporaryPasswordSentAt: new Date(),
    },
  });

  const message = [
    `A Modo Mio`,
    ``,
    `Sua nova senha temporaria: ${temporaryPassword}`,
    `Ela expira em 30 minutos.`,
    `Se esse prazo passar, solicite uma nova senha na tela de login.`,
  ].join("\n");

  try {
    await sendTextMessage({
      phone: normalizedPhone,
      message,
    });

    await createAccessAudit({
      provider: "password",
      eventType: "passwordResetSent",
      success: true,
      user: updated,
      request: params.request,
      details: { expiresAt: expiresAt.toISOString(), phone: normalizedPhone },
    });

    return {
      ok: true as const,
      message:
        "Enviamos uma nova senha temporária para o WhatsApp cadastrado. Ela expira em 30 minutos.",
    };
  } catch (error) {
    await createAccessAudit({
      provider: "password",
      eventType: "passwordResetFailed",
      success: false,
      user: updated,
      request: params.request,
      details: {
        reason: "whatsapp-send-failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      ok: false as const,
      message: "Não foi possível enviar a nova senha pelo WhatsApp.",
    };
  }
}

export async function authorizeGoogleUser(params: {
  email: string;
  name: string;
  avatarURL?: string | null;
  googleSub?: string | null;
  request?: Request;
}) {
  const email = normalizeUserEmail(params.email);
  if (!email) return null;

  console.info("[auth.google.authorize] inbound", {
    email,
    googleSub: params.googleSub || null,
    whitelist: getLegacyWhitelistedEmails(),
  });

  const existing = await prismaClient.userAccess.findFirst({
    where: {
      OR: [
        { email },
        params.googleSub ? { googleSub: params.googleSub } : undefined,
      ].filter(Boolean) as any,
    },
  });

  if (existing) {
    console.info("[auth.google.authorize] existing-user", {
      id: existing.id,
      username: existing.username,
      email: existing.email,
      isActive: existing.isActive,
      allowGoogleLogin: existing.allowGoogleLogin,
      googleSub: existing.googleSub,
    });

    if (!existing.isActive || !existing.allowGoogleLogin) {
      console.warn("[auth.google.authorize] denied-existing-user", {
        email,
        reason: !existing.isActive ? "inactive-user" : "google-login-disabled",
      });

      if (params.request) {
        await createAccessAudit({
          provider: "google",
          eventType: "loginFailure",
          success: false,
          user: existing,
          request: params.request,
          details: {
            reason: !existing.isActive ? "inactive-user" : "google-login-disabled",
          },
        });
      }

      return null;
    }

    const updated = await prismaClient.userAccess.update({
      where: { id: existing.id },
      data: {
        email,
        name: params.name || existing.name || existing.username,
        avatarUrl: params.avatarURL || existing.avatarUrl || null,
        googleSub: params.googleSub || existing.googleSub || null,
        lastLoginAt: new Date(),
        lastGoogleLoginAt: new Date(),
      },
    });

    return getAuthenticatedUserProfile(updated, "google");
  }

  if (!getLegacyWhitelistedEmails().includes(email)) {
    console.warn("[auth.google.authorize] denied-whitelist", {
      email,
      whitelist: getLegacyWhitelistedEmails(),
      reason: "not-authorized",
    });

    if (params.request) {
      await createAccessAudit({
        provider: "google",
        eventType: "loginFailure",
        success: false,
        email,
        request: params.request,
        details: { reason: "not-authorized" },
      });
    }
    return null;
  }

  const created = await prismaClient.userAccess.create({
    data: {
      username: await buildAvailableUsernameFromEmail(email),
      email,
      name: params.name || email,
      avatarUrl: params.avatarURL || null,
      googleSub: params.googleSub || null,
      roles: ["user"],
      isActive: true,
      allowGoogleLogin: true,
      allowPasswordLogin: false,
      source: "whitelistMigration",
      lastLoginAt: new Date(),
      lastGoogleLoginAt: new Date(),
    } as any,
  });

  console.info("[auth.google.authorize] whitelist-migration-created", {
    id: created.id,
    username: created.username,
    email: created.email,
  });

  return getAuthenticatedUserProfile(created, "google");
}

export async function createOrUpdateManagedUser(params: {
  id?: string | null;
  username: string;
  email?: string | null;
  name?: string | null;
  mobilePhone?: string | null;
  roles?: UserRole[];
  isActive: boolean;
  allowGoogleLogin: boolean;
  allowPasswordLogin: boolean;
  password?: string | null;
}) {
  const username = normalizeUsername(params.username);
  const email = normalizeUserEmail(params.email);
  const rawPhone = String(params.mobilePhone || "").trim();
  const mobilePhone = rawPhone ? normalizePhone(rawPhone) : null;

  if (!username) throw new Error("Username é obrigatório.");
  if (rawPhone && !mobilePhone) {
    throw new Error("Celular inválido. Use DDI + DDD + número, apenas dígitos.");
  }

  const baseData = {
    username,
    email,
    name: String(params.name || "").trim() || null,
    mobilePhone,
    roles: normalizeUserRoles(params.roles),
    isActive: params.isActive,
    allowGoogleLogin: params.allowGoogleLogin,
    allowPasswordLogin: params.allowPasswordLogin,
  };

  const data: Record<string, any> = params.id
    ? { ...baseData }
    : { ...baseData, source: "manual" };

  if (params.password && String(params.password).trim()) {
    data.passwordHash = await hashPassword(String(params.password));
    data.passwordUpdatedAt = new Date();
    data.allowPasswordLogin = true;
  }

  if (params.id) {
    return prismaClient.userAccess.update({
      where: { id: params.id },
      data: data as any,
    });
  }

  return prismaClient.userAccess.create({
    data: data as any,
  });
}

export function getAuthenticatedUserProfile(
  user: UserAccess & { roles: UserRole[] },
  authProvider: AuditProvider
): AuthenticatedUserProfile {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    email: user.email || "",
    avatarURL: user.avatarUrl || "",
    mobilePhone: user.mobilePhone || null,
    roles: normalizeUserRoles(user.roles),
    provisionSource: user.source,
    authProvider,
  };
}

export async function createAccessAudit(params: {
  provider: AuditProvider;
  eventType:
    | "loginSuccess"
    | "loginFailure"
    | "logout"
    | "logoutAllDevices"
    | "passwordResetRequested"
    | "passwordResetSent"
    | "passwordResetFailed"
    | "sessionExpired"
    | "sessionRevoked"
    | "sessionBlocked";
  success: boolean;
  user?: UserAccess | null;
  userId?: string | null;
  actorUserId?: string | null;
  session?: UserSession | null;
  username?: string | null;
  email?: string | null;
  request?: Request;
  details?: Record<string, unknown>;
}) {
  const requestMeta = params.request ? getRequestMeta(params.request) : null;

  await prismaClient.accessAudit.create({
    data: {
      userId: params.user?.id || params.userId || null,
      actorUserId: params.actorUserId || null,
      sessionId: params.session?.id || null,
      username: params.user?.username || params.username || null,
      email: params.user?.email || params.email || null,
      provider: params.provider,
      eventType: params.eventType,
      success: params.success,
      sessionDeviceLabel: params.session?.deviceLabel || null,
      ipAddress: requestMeta?.ipAddress || null,
      userAgent: requestMeta?.userAgent || null,
      details: (params.details || undefined) as any,
    },
  });
}

function getRequestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || realIp || null,
    userAgent: request.headers.get("user-agent"),
  };
}

async function buildAvailableUsernameFromEmail(email: string) {
  const base = normalizeUsername(email.split("@")[0]) || "user";
  let candidate = base;
  let counter = 1;

  while (true) {
    const exists = await prismaClient.userAccess.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;
    counter += 1;
    candidate = `${base}${counter}`;
  }
}
