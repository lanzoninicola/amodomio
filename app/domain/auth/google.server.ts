<<<<<<< Updated upstream
import { createCookieSessionStorage, redirect } from "@remix-run/node";
=======
// https://www.npmjs.com/package/remix-auth-google

import { createCookieSessionStorage } from "@remix-run/node";
>>>>>>> Stashed changes
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import {
  GOOGLE_AUTH_COOKIE_SECRET,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "./constants.server";
<<<<<<< Updated upstream
import {
  authenticatePasswordLogin,
  authorizeGoogleUser,
} from "./admin-user-access.server";
import {
  createAdminUserSession,
  destroySessionCookie,
  getAuthenticatedSessionFromRequest,
  revokeCurrentAdminSession,
} from "./admin-user-session.server";
import type { AuthenticatedLoggedUser, AuthenticatedUserProfile } from "./types.server";

type AuthFlowOptions = {
  successRedirect?: string;
  failureRedirect?: string;
  context?: unknown;
  throwOnError?: boolean;
};

const oauthSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "google_oauth_session",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    secrets: [GOOGLE_AUTH_COOKIE_SECRET || "AM0D0MI02O24"],
    secure: process.env.NODE_ENV === "production",
  },
});

const baseAuthenticator = new Authenticator<AuthenticatedUserProfile>(oauthSessionStorage, {
=======
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
>>>>>>> Stashed changes
  throwOnError: true,
});

let googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID || "",
    clientSecret: GOOGLE_CLIENT_SECRET || "",
    callbackURL: GOOGLE_CALLBACK_URL || "",
  },
<<<<<<< Updated upstream
  async ({ profile }) => {
    const emailInbound = profile.emails?.[0]?.value;
    console.info("[auth.google.callback] profile", {
      profileId: profile.id,
      displayName: profile.displayName,
      emails: profile.emails?.map((entry) => entry.value) || [],
    });

    if (!emailInbound) {
      console.warn("[auth.google.callback] denied-no-email", {
        profileId: profile.id,
      });
      throw redirect("/login?_status=auth-failed");
    }

    const user = await authorizeGoogleUser({
      email: emailInbound,
      name: profile.displayName || emailInbound,
      avatarURL: profile.photos?.[0]?.value || null,
      googleSub: profile.id,
    });

    if (!user) {
      console.warn("[auth.google.callback] denied-no-user", {
        emailInbound,
        profileId: profile.id,
      });
      throw redirect("/login?_status=access-denied");
    }

    console.info("[auth.google.callback] authorized", {
      emailInbound,
      userId: user.id,
      username: user.username,
    });

    return user;
  }
);
=======
  async ({ accessToken, refreshToken, extraParams, profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    // return User.findOrCreate({ email: profile.emails[0].value });

    // const profileDomain = profile._json.hd;

    // if (profileDomain !== "limbersoftware.com.br") {
    //   return null;
    // }
    const emailWhitelist = process.env.GOOGLE_AUTH_EMAIL_WHITELIST;
    const emailWhitelistArray = emailWhitelist?.split(",");
>>>>>>> Stashed changes

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
    };

    console.log("google.server.ts", user);

<<<<<<< Updated upstream
async function authenticateWithGoogle(request: Request, options?: AuthFlowOptions) {
  const user = await baseAuthenticator.authenticate("google", request, options as any);
  const { setCookie } = await createAdminUserSession({
    request,
    user,
    authProvider: "google",
  });
  const oauthSession = await oauthSessionStorage.getSession(request.headers.get("Cookie"));
  const clearOauthCookie = await oauthSessionStorage.destroySession(oauthSession);
  const headers = new Headers();
  headers.append("Set-Cookie", setCookie);
  headers.append("Set-Cookie", clearOauthCookie);

  throw redirect(options?.successRedirect || "/admin", {
    headers,
  });
}

async function authenticateWithPassword(request: Request, options?: AuthFlowOptions) {
  const formData = await request.formData();
  const identifier = String(formData.get("identifier") || "");
  const password = String(formData.get("password") || "");

  const user = await authenticatePasswordLogin({
    identifier,
    password,
    request,
  });

  if (!user) {
    throw redirect(options?.failureRedirect || "/login?_status=password-failed");
=======
    return user;
>>>>>>> Stashed changes
  }
);

authenticator.use(googleStrategy);
