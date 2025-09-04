import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";
import { getSessionQRCode } from "~/domain/bot/wpp.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuthUser(request);
  const url = new URL(request.url);
  const sessionKey = String(url.searchParams.get("sessionKey") || "").trim();
  if (!sessionKey)
    return json(
      { ok: false, error: "sessionKey é obrigatório" },
      { status: 400 }
    );

  const qr = await getSessionQRCode(sessionKey).catch(() => ({ qrcode: null }));
  return json({ ok: true, qrcode: qr?.qrcode ?? null });
}
