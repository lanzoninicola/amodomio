import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticatePasswordLogin } from "~/domain/auth/user-access.server";
import {
  createBearerUserSession,
  getAuthenticatedBearerSession,
  revokeBearerSession,
} from "~/domain/auth/user-session.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";

type LoginPayload = {
  identifier?: string;
  password?: string;
  deviceLabel?: string;
};

function publicUser(user: {
  id: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    roles: user.roles,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await getAuthenticatedBearerSession(request);
  if (!auth.user) return json({ error: "unauthorized" }, { status: 401 });
  return json({ ok: true, user: publicUser(auth.user) });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "DELETE") {
    await revokeBearerSession(request);
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimit = restApi.rateLimitCheck(request, {
    bucket: "kds-mobile-login",
    limitPerMinute: 10,
  });
  if (!rateLimit.success) {
    const retrySeconds = rateLimit.retryIn
      ? Math.ceil(rateLimit.retryIn / 1000)
      : 60;
    return json(
      {
        error: "too_many_requests",
        message: "Muitas tentativas. Aguarde e tente novamente.",
      },
      { status: 429, headers: { "Retry-After": String(retrySeconds) } }
    );
  }

  let payload: LoginPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const identifier = String(payload.identifier || "").trim();
  const password = String(payload.password || "");
  if (!identifier || !password) {
    return json({ error: "missing_credentials" }, { status: 400 });
  }

  const user = await authenticatePasswordLogin({
    identifier,
    password,
    request,
  });
  if (!user) {
    return json(
      { error: "invalid_credentials", message: "Usuário ou senha inválidos." },
      { status: 401 }
    );
  }

  const session = await createBearerUserSession({
    request,
    user,
    authProvider: "password",
    deviceLabel: payload.deviceLabel || "KDS Mobile",
  });

  return json({
    ok: true,
    token: session.token,
    expiresAt: session.session.absoluteExpiresAt.toISOString(),
    user: publicUser(session.user),
  });
}
