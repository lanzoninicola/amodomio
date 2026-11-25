import { waitUntil } from "@vercel/functions";
import type { ActionFunctionArgs } from "@remix-run/node";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "~/lib/prisma/client.server";
import { suitableDiagnosticExcerpt } from "~/domain/suitable/suitable-client.server";
import { syncInboxOrder } from "~/domain/suitable/suitable-inbox.server";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function validSignature(raw: string, sig: string | null) {
  const secret = process.env.SUITABLE_WEBHOOK_SECRET;
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(sig.trim(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!process.env.SUITABLE_WEBHOOK_SECRET) {
    console.error("[Suitable missing_webhook_secret] Configure SUITABLE_WEBHOOK_SECRET no servidor com o segredo obtido ao criar ou rotacionar o webhook.");
    return new Response("[Suitable webhook_unavailable] Configuração do receptor incompleta.", { status: 503 });
  }
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-app-signature")))
    return new Response("[Suitable invalid_signature] X-App-Signature ausente ou incompatível com HMAC-SHA256 do corpo bruto. Confira o segredo cadastrado no receptor.", { status: 401 });

  let evt: {
    id?: string;
    type?: string;
    created_at?: string;
    data?: { order_id?: number | string; status?: string };
  };
  try {
    evt = JSON.parse(raw);
  } catch {
    return new Response("[Suitable invalid_json] O corpo do webhook deve conter JSON válido.", { status: 400 });
  }
  if (!evt || typeof evt.id !== "string" || typeof evt.type !== "string" || !evt.id || !evt.type) return new Response("[Suitable invalid_payload] Campos id e type devem ser strings não vazias.", { status: 400 });
  const created = evt.created_at ? Date.parse(evt.created_at) : NaN;
  if (Number.isFinite(created) && Date.now() - created > MAX_AGE_MS)
    return new Response("Stale", { status: 200 });

  if (!["new_order", "paid_order", "changed_order_status"].includes(evt.type))
    return new Response("ignored", { status: 200 });

  const orderId = Number(evt.data?.order_id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0)
    return new Response("[Suitable invalid_order_id] data.order_id deve ser um inteiro positivo.", { status: 400 });

  try {
    await prisma.suitableWebhookEvent.create({
      data: { eventId: evt.id, type: evt.type },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return new Response("duplicate", { status: 200 });
    console.error("[Suitable event_persistence_failed]", {
      eventId: evt.id, eventType: evt.type, orderId,
      stage: "suitableWebhookEvent.create",
      databaseCode: error && typeof error === "object" && "code" in error ? error.code : "unknown",
      hint: "Confira conexão, migrations e tabela suitable_webhook_event. Evento não confirmado; o provedor deve reenviar.",
    });
    return new Response("[Suitable event_persistence_failed] Não foi possível registrar o evento. Tente novamente.", { status: 503 });
  }

  // Processa fora do ciclo da resposta (limite de 5s do Suitable).
  waitUntil(processOrder(orderId, evt.id, evt.type, evt.data?.status).catch((error) => {
    console.error("[Suitable process_order_failed]", {
      orderId, eventId: evt.id, stage: "process_order",
      error: suitableDiagnosticExcerpt(error instanceof Error ? error.message : String(error)),
    });
  }));
  return new Response("ok", { status: 200 });
}

async function processOrder(
  orderId: number,
  eventId: string,
  type: string,
  status?: string
) {
  if (type === "changed_order_status" && status === "cancelled") {
    await prisma.suitableOrderInbox.updateMany({
      where: { suitableOrderId: orderId, status: "pending" },
      data: { status: "dismissed", lastEventId: eventId, lastEventType: type },
    });
    return;
  }
  if (type === "changed_order_status") {
    const exists = await prisma.suitableOrderInbox.findUnique({
      where: { suitableOrderId: orderId },
      select: { id: true },
    });
    if (!exists) return; // só acompanha pedidos já recebidos
  }
  await syncInboxOrder(orderId, eventId, type, { signal: AbortSignal.timeout(3_000) });
}
