export type LoggedUser =
  | {
      name: string;
      email: string;
      avatarURL: string;
      role?: string;
    }
  | null
  | false;
