export type LoggedUser =
  | {
      id?: string;
      username?: string;
      name: string;
      email: string;
      avatarURL: string;
      roles?: string[];
    }
  | null
  | false;

export type AuthenticatedUserProfile = {
  id: string;
  username: string;
  name: string;
  email: string;
  avatarURL: string;
  mobilePhone?: string | null;
  roles: string[];
  provisionSource: string;
  authProvider: string;
};

export type AuthenticatedLoggedUser = AuthenticatedUserProfile & {
  sessionId: string;
  sessionStatus: string;
  sessionDeviceLabel?: string | null;
  sessionLastActivityAt: Date;
  sessionIdleExpiresAt: Date;
  sessionAbsoluteExpiresAt: Date;
};
