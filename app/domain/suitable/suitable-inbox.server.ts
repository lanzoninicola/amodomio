import prisma from "~/lib/prisma/client.server";
import { fetchSuitableOrder, listSuitableOrders } from "./suitable-client.server";

/** Busca o pedido na Suitable e grava/atualiza a caixa de entrada. Nunca lança. */
export async function syncInboxOrder(
  orderId: number,
  eventId: string | null,
  type: string
) {
  try {
    const details = await fetchSuitableOrder(orderId);
    await prisma.suitableOrderInbox.upsert({
      where: { suitableOrderId: orderId },
      create: {
        suitableOrderId: orderId,
        lastEventId: eventId,
        lastEventType: type,
        paid: details.paid,
        details: details as any,
      },
      update: {
        lastEventId: eventId,
        lastEventType: type,
        paid: details.paid,
        details: details as any,
        fetchError: null,
      },
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.suitableOrderInbox.upsert({
      where: { suitableOrderId: orderId },
      create: {
        suitableOrderId: orderId,
        lastEventId: eventId,
        lastEventType: type,
        fetchError: msg,
      },
      update: { fetchError: msg },
    });
    return { ok: false as const, error: msg };
  }
}

const SKIP_STATUS = new Set(["cancelled", "abandoned", "pending_payment"]);

/** Recupera pedidos das últimas `hours` horas que não chegaram por webhook. */
export async function reconcileSuitableOrders(hours = 24, maxNew = 50) {
  const createdFrom = new Date(Date.now() - hours * 3600_000).toISOString();
  const seen: number[] = [];
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const r = await listSuitableOrders({ createdFrom, page });
    total = r.count;
    for (const o of r.results) if (!SKIP_STATUS.has(o.status)) seen.push(o.id);
    if (page * r.page_size >= r.count) break;
  }
  const known = new Set(
    (
      await prisma.suitableOrderInbox.findMany({
        where: { suitableOrderId: { in: seen } },
        select: { suitableOrderId: true },
      })
    ).map((k) => k.suitableOrderId)
  );
  const missing = seen.filter((id) => !known.has(id)).slice(0, maxNew);
  let recovered = 0;
  for (const id of missing) {
    if ((await syncInboxOrder(id, null, "reconcile")).ok) recovered++;
  }
  return { checked: total, missing: missing.length, recovered };
}
