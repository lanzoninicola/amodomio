import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import {
  connectInstagramFromAuthorizationCode,
  validateInstagramFacebookState,
} from "~/domain/instagram/instagram-facebook-login.server";

const ADMIN_ROUTE = "/admin/marketing/instagram";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = String(url.searchParams.get("code") || "");
  const state = String(url.searchParams.get("state") || "");
  const stateResult = await validateInstagramFacebookState(request, state);
  const headers = { "Set-Cookie": stateResult.clearCookie };

  if (!stateResult.valid) {
    throw redirect(`${ADMIN_ROUTE}?status=error&reason=invalid_state`, {
      headers,
    });
  }

  if (error) {
    const reason = encodeURIComponent(
      errorDescription || "A autorização foi cancelada."
    );
    throw redirect(`${ADMIN_ROUTE}?status=error&message=${reason}`, {
      headers,
    });
  }

  if (!code) {
    throw redirect(`${ADMIN_ROUTE}?status=error&reason=missing_code`, {
      headers,
    });
  }

  try {
    await connectInstagramFromAuthorizationCode(code);
    throw redirect(`${ADMIN_ROUTE}?status=connected`, { headers });
  } catch (connectionError) {
    if (connectionError instanceof Response) throw connectionError;
    console.error("[instagram.facebook.callback]", connectionError);
    const message = encodeURIComponent(
      connectionError instanceof Error
        ? connectionError.message
        : "Não foi possível conectar o Instagram."
    );
    throw redirect(`${ADMIN_ROUTE}?status=error&message=${message}`, {
      headers,
    });
  }
}
