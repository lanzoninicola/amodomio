import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";
import { sendTextMessage } from "~/domain/bot/wpp.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireAuthUser(request);
  const form = await request.formData();
  const sessionKey = String(form.get("sessionKey") || "").trim();
  const to = String(form.get("to") || "").trim();
  const text = String(form.get("text") || "").trim();

  if (!sessionKey || !to || !text) {
    return json(
      { ok: false, error: "sessionKey, to e text são obrigatórios" },
      { status: 400 }
    );
  }
  const sent = await sendTextMessage(sessionKey, to, text);
  return json({ ok: true, sent });
}

export { action as loader }; // opcional, para testes GET
