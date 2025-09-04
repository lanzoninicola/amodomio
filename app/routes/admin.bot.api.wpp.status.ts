import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";
import { setSessionStatus } from "~/domain/bot/session.server";
import { getSessionStatus } from "~/domain/bot/wpp.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuthUser(request);
  const url = new URL(request.url);
  const sessionKey = String(url.searchParams.get("sessionKey") || "").trim();
  if (!sessionKey)
    return json(
      { ok: false, error: "sessionKey é obrigatório" },
      { status: 400 }
    );

  const status = await getSessionStatus(sessionKey);
  // Heurística simples: se isLoggedIn === true -> connected
  if (status?.isLoggedIn) {
    await setSessionStatus(sessionKey, "connected", true);
  }
  return json({ ok: true, status });
}
