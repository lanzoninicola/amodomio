// https://www.npmjs.com/package/remix-auth-google

import { createCookieSessionStorage } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import {
  AUTH_COOKIE_SECRET,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "./constants.server";
import { LoggedUser } from "./types.server";
import prismaClient from "~/lib/prisma/client.server";

function normalizeUserEmail(email?: string | null) {
  const value = String(email || "").trim().toLowerCase();
  return value || null;
}

const cookieSecret = AUTH_COOKIE_SECRET || "AM0D0MI02O24";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60 * 1000 * 30,
  secrets: [cookieSecret],
  secure: process.env.NODE_ENV !== "development",
};

const sessionStorage = createCookieSessionStorage({
  cookie: cookieOptions,
});

export const authenticator = new Authenticator<LoggedUser>(sessionStorage, {
  throwOnError: true,
});

let googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID || "",
    clientSecret: GOOGLE_CLIENT_SECRET || "",
    callbackURL: GOOGLE_CALLBACK_URL || "",
  },
  async ({ profile }) => {
    const emailWhitelistArray = String(process.env.GOOGLE_AUTH_EMAIL_WHITELIST || "")
      .split(",")
      .map((email) => normalizeUserEmail(email))
      .filter((email): email is string => Boolean(email));

    const emailInbound = normalizeUserEmail(profile.emails?.[0]?.value);

    if (!emailInbound) {
      return null;
    }

    if (!emailWhitelistArray.length) {
      return null;
    }

    if (!emailWhitelistArray.includes(emailInbound)) {
      return false;
    }

    const systemUser = await prismaClient.userAccess.findFirst({
      where: {
        email: emailInbound,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatarUrl: true,
        roles: true,
      },
    });

    const user: LoggedUser = systemUser
      ? {
          id: systemUser.id,
          username: systemUser.username,
          name: systemUser.name || profile.displayName,
          email: systemUser.email || emailInbound,
          avatarURL: systemUser.avatarUrl || profile.photos?.[0]?.value || "",
          roles: systemUser.roles,
        }
      : {
          name: profile.displayName,
          email: emailInbound,
          avatarURL: profile.photos?.[0]?.value || "",
          roles: [],
        };

    return user;
  }
);

authenticator.use(googleStrategy);
