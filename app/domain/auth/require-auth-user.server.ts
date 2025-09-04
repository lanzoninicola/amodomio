import { redirect } from "@remix-run/react";
import { authenticator } from "./google.server";
import { LoggedUser } from "./types.server";

export async function requireAuthUser(request: Request) {
  const loggedUser: LoggedUser = await authenticator.isAuthenticated(request);

  if (!loggedUser) {
    throw redirect("/login");
  }
}
