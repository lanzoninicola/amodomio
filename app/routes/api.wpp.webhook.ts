import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { handleInboundMessage } from "~/domain/bot/auto-responder.server";

// Defina sua sessão (pode ser dinâmica depois)
const SESSION = "amodomio";

export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.json().catch(() => ({}));

  // Ajuste conforme payload real do seu WppConnect Server
  const inbound = {
    from: payload?.from ?? payload?.sender?.id ?? "",
    to: payload?.to ?? payload?.recipient?.id ?? "",
    body: payload?.body ?? payload?.text ?? "",
    timestamp: payload?.timestamp,
  };

  const result = await handleInboundMessage(SESSION, inbound);
  return json({ ok: true, result });
}

// GET simples para testar no navegador
export const loader = () => json({ ok: true, message: "Webhook ativo" });
