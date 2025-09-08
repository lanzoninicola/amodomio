import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { handleInboundMessage } from "~/domain/bot/auto-responder.server";

// Defina sua sessão (pode ser dinâmica depois)
const SESSION = "amodomio";
// Nome do header que o wppconnect-server envia
const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

export async function action({ request }: ActionFunctionArgs) {
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

  // 3) Parse seguro do JSON (evita crash em payload inválido)
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    // Se não for JSON válido, rejeita
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // console.log("webhook triggered from wppconnect-server", payload);

  const event = payload?.event;

  // 4) Trate apenas os eventos que você usa (ex.: onmessage)
  if (event === "onmessage") {
    const inbound = {
      from: payload?.from ?? payload?.sender?.id ?? "",
      to: payload?.to ?? payload?.recipient?.id ?? "",
      body: payload?.body ?? payload?.text ?? "",
      timestamp: payload?.timestamp ?? Date.now(),
    };

    try {
      await handleInboundMessage(SESSION, inbound);
    } catch (err) {
      console.error("Erro ao processar inbound:", err);
      // Responda 200 para não forçar re-tentativas infinitas do webhook,
      // mas registre o erro para observabilidade
    }
  }

  // 5) Sempre responda rápido
  return json({ ok: true });
}

// GET simples para testar no navegador
export const loader = () => json({ ok: true, message: "Webhook ativo" });
