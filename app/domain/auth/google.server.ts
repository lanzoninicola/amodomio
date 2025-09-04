// https://www.npmjs.com/package/remix-auth-google

import { createCookieSessionStorage } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import {
  GOOGLE_AUTH_COOKIE_SECRET,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "./constants.server";
import { LoggedUser } from "./types.server";

const cookieSecret = GOOGLE_AUTH_COOKIE_SECRET || "AM0D0MI02O24";

// Personalize this options for your usage.
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
  async ({ accessToken, refreshToken, extraParams, profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    // return User.findOrCreate({ email: profile.emails[0].value });

    // const profileDomain = profile._json.hd;

    // if (profileDomain !== "limbersoftware.com.br") {
    //   return null;
    // }
    const emailWhitelist = process.env.GOOGLE_AUTH_EMAIL_WHITELIST;
    const emailWhitelistArray = emailWhitelist?.split(",");

    console.log("google.server.ts", emailWhitelistArray);

    const emailInbound = profile.emails[0].value;

    if (!emailInbound) {
      return null;
    }

    if (!emailWhitelist) {
      return null;
    }

    if (emailWhitelistArray && !emailWhitelistArray.includes(emailInbound)) {
      return false;
    }

    const user: LoggedUser = {
      name: profile.displayName,
      email: emailInbound,
      avatarURL: profile.photos[0].value,
      role: "ADMIN",
    };

    console.log("google.server.ts", user);

    return user;
  }
);

authenticator.use(googleStrategy);
