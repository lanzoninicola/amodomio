import { User } from "../user/user.model";

export type LoggedUser =
  | User
  | {
      name: string;
      email: string;
      avatarURL: string;
    }
  | null
  | false;
