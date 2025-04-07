export type LoggedUser =
  | {
      name: string;
      email: string;
      avatarURL: string;
    }
  | null
  | false;
