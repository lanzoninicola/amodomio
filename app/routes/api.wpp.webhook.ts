import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { handleInboundMessage } from "~/domain/bot/auto-responder.server";

// Nome do header que o wppconnect-server envia
const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

export async function action({ request }: ActionFunctionArgs) {
  console.log("WPP webhook running");
  // 1) Aceita apenas POST
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  // 2) Autenticação do webhook via header secreto
  const expectedSecret = process.env.WPP_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get(WEBHOOK_SECRET_HEADER);

  if (!expectedSecret) {
    // Falha de configuração do servidor
    console.error("REST_API_SECRET_KEY não configurada no servidor.");
    return json(
      { ok: false, error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Precisamos interpretar o corpo como texto primeiro (pode não ser JSON)
  const raw = await request.text();
  console.log({ raw });
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { data: raw };
  }

  console.log({ payload });

  const event = payload?.event || payload?.type || "message";
  if (event === "onmessage" || event === "message") {
    const inbound = {
      from: payload?.from ?? payload?.sender?.id ?? payload?.sender ?? "",
      to: payload?.to ?? payload?.recipient?.id ?? payload?.recipient ?? "",
      body:
        payload?.body ??
        payload?.text ??
        payload?.message?.text ??
        payload?.message?.body ??
        "",
      timestamp: payload?.timestamp ?? Date.now(),
      raw: payload,
    };

    const session =
      payload?.session || process.env.WPP_DEFAULT_SESSION || "amodomio";
    await handleInboundMessage(session, inbound);
  }

  return json({ ok: true });
}
// GET simples para testar no navegador
export const loader = () => json({ ok: true, message: "Webhook ativo" });
