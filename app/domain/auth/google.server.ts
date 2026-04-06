import { redirect } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import {
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "./constants.server";
import {
  authenticatePasswordLogin,
  authorizeGoogleUser,
} from "./admin-user-access.server";
import {
  createAdminUserSession,
  destroySessionCookie,
  getAuthenticatedSessionFromRequest,
  revokeCurrentAdminSession,
  sessionStorage,
} from "./admin-user-session.server";
import type { AuthenticatedLoggedUser, AuthenticatedUserProfile } from "./types.server";

type AuthFlowOptions = {
  successRedirect?: string;
  failureRedirect?: string;
  context?: unknown;
  throwOnError?: boolean;
};

const baseAuthenticator = new Authenticator<AuthenticatedUserProfile>(sessionStorage, {
  throwOnError: true,
  sessionKey: "oauth-user",
});

const googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID || "",
    clientSecret: GOOGLE_CLIENT_SECRET || "",
    callbackURL: GOOGLE_CALLBACK_URL || "",
  },
  async ({ profile }) => {
    const emailInbound = profile.emails?.[0]?.value;
    if (!emailInbound) {
      throw redirect("/login?_status=auth-failed");
    }

    const user = await authorizeGoogleUser({
      email: emailInbound,
      name: profile.displayName || emailInbound,
      avatarURL: profile.photos?.[0]?.value || null,
      googleSub: profile.id,
    });

    if (!user) {
      throw redirect("/login?_status=access-denied");
    }

    return user;
  }
);

baseAuthenticator.use(googleStrategy);

export const authenticator = {
  authenticate(strategy: string, request: Request, options?: AuthFlowOptions) {
    if (strategy === "google") {
      return authenticateWithGoogle(request, options);
    }

    if (strategy === "password") {
      return authenticateWithPassword(request, options);
    }

    throw new Error(`Unsupported strategy: ${strategy}`);
  },
  async isAuthenticated(
    request: Request,
    options?: {
      successRedirect?: string;
      failureRedirect?: string;
      headers?: HeadersInit;
    }
  ): Promise<AuthenticatedLoggedUser> {
    const currentSession = await getAuthenticatedSessionFromRequest(request);

    if (currentSession.user) {
      if (options?.successRedirect) {
        throw redirect(options.successRedirect, { headers: options.headers });
      }
      return currentSession.user;
    }

    if (currentSession.destroyCookie) {
      throw redirect(options?.failureRedirect || "/login?_status=session-expired", {
        headers: {
          "Set-Cookie": await destroySessionCookie(request),
        },
      });
    }

    if (options?.failureRedirect) {
      throw redirect(options.failureRedirect, { headers: options.headers });
    }

    throw redirect("/login");
  },
  async logout(request: Request, options?: { redirectTo?: string }) {
    const redirectTo = options?.redirectTo || "/login";
    const setCookie = await revokeCurrentAdminSession({ request });

    throw redirect(redirectTo, {
      headers: {
        "Set-Cookie": setCookie,
      },
    });
  },
};

async function authenticateWithGoogle(request: Request, options?: AuthFlowOptions) {
  const user = await baseAuthenticator.authenticate("google", request, options as any);
  const { setCookie } = await createAdminUserSession({
    request,
    user,
    authProvider: "google",
  });

  throw redirect(options?.successRedirect || "/admin", {
    headers: {
      "Set-Cookie": setCookie,
    },
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
  }

  const { setCookie } = await createAdminUserSession({
    request,
    user,
    authProvider: "password",
  });

  throw redirect(options?.successRedirect || "/admin", {
    headers: {
      "Set-Cookie": setCookie,
    },
  });
}
