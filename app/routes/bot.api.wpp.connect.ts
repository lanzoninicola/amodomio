import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";
import { upsertWhatsappSession } from "~/domain/bot/session.server";
import { getSessionQRCode, startSession } from "~/domain/bot/wpp.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireAuthUser(request);
  const form = await request.formData();
  const sessionKey = String(form.get("sessionKey") || "").trim();
  if (!sessionKey)
    return json(
      { ok: false, error: "sessionKey é obrigatório" },
      { status: 400 }
    );

  await upsertWhatsappSession(sessionKey);
  const started = await startSession(sessionKey);
  // Tentativa imediata de obter QR (pode ainda não estar disponível)
  const qr = await getSessionQRCode(sessionKey).catch(() => null);

  return json({ ok: true, started, qrcode: qr?.qrcode ?? null });
}

export { action as loader }; // permite GET para testes se desejar
