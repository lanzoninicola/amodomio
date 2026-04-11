import type { UserRole } from "@prisma/client";

const ROLE_INHERITANCE: Record<UserRole, UserRole[]> = {
  user: ["user"],
  admin: ["admin", "user"],
  superAdmin: ["superAdmin", "admin", "user"],
};

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

