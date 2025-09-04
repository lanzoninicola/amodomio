import { json, type ActionFunctionArgs } from "@remix-run/node";
import { logoutSession } from "~/domain/bot/wpp.server";
import { setSessionStatus } from "~/domain/bot/session.server";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireAuthUser(request);
  const form = await request.formData();
  const sessionKey = String(form.get("sessionKey") || "").trim();
  if (!sessionKey)
    return json(
      { ok: false, error: "sessionKey é obrigatório" },
      { status: 400 }
    );

  const res = await logoutSession(sessionKey);
  await setSessionStatus(sessionKey, "logout", false);
  return json({ ok: true, res });
}

export { action as loader };
