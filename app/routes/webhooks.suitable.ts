import type { ActionFunctionArgs } from "@remix-run/node";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "~/lib/prisma/client.server";
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
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-app-signature")))
    return new Response("Invalid signature", { status: 401 });

  let evt: {
    id?: string;
    type?: string;
    created_at?: string;
    data?: { order_id?: number | string; status?: string };
  };
  try {
    evt = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!evt.id || !evt.type) return new Response("Bad payload", { status: 400 });
  const created = evt.created_at ? Date.parse(evt.created_at) : NaN;
  if (Number.isFinite(created) && Date.now() - created > MAX_AGE_MS)
    return new Response("Stale", { status: 200 });

  if (!["new_order", "paid_order", "changed_order_status"].includes(evt.type))
    return new Response("ignored", { status: 200 });

  try {
    await prisma.suitableWebhookEvent.create({
      data: { eventId: evt.id, type: evt.type },
    });
  } catch {
    return new Response("duplicate", { status: 200 }); // já processado
  }

  const orderId = Number(evt.data?.order_id);
  if (!Number.isInteger(orderId)) return new Response("no order", { status: 200 });

  // Processa fora do ciclo da resposta (limite de 5s do Suitable).
  void processOrder(orderId, evt.id, evt.type, evt.data?.status).catch((e) =>
    console.error("[suitable] processOrder", orderId, e)
  );
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
  await syncInboxOrder(orderId, eventId, type);
}
