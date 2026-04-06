import type {
  AccessAuditProvider,
  AdminUserProvisionSource,
  AdminUserRole,
  AdminUserSessionStatus,
} from "@prisma/client";

export type AuthenticatedUserProfile = {
  id: string;
  username: string;
  name: string;
  email: string;
  avatarURL: string;
  mobilePhone?: string | null;
  roles: AdminUserRole[];
  provisionSource: AdminUserProvisionSource;
  authProvider: AccessAuditProvider;
};

export type LoggedUserDraft = AuthenticatedUserProfile & {
  sessionId: string;
  sessionStatus: AdminUserSessionStatus;
  sessionDeviceLabel?: string | null;
  sessionLastActivityAt: Date;
  sessionIdleExpiresAt: Date;
  sessionAbsoluteExpiresAt: Date;
};

export type LoggedUser = LoggedUserDraft | null;

export type AuthenticatedLoggedUser = Extract<LoggedUser, { id: string }>;
