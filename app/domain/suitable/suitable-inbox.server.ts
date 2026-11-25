import prisma from "~/lib/prisma/client.server";
import { fetchSuitableOrder, listSuitableOrders, suitableDiagnosticExcerpt, type SuitableRequestOptions } from "./suitable-client.server";

/** Busca e persiste o pedido; falhas ficam na inbox e nos logs. */
export async function syncInboxOrder(
  orderId: number,
  eventId: string | null,
  type: string,
  options: SuitableRequestOptions = {}
) {
  let stage = "fetch_order";
  try {
    const details = await fetchSuitableOrder(orderId, options);
    stage = "persist_order";
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
    const reason = suitableDiagnosticExcerpt(e instanceof Error ? e.message : String(e), 1500);
    const msg = `[Suitable sync_failed] orderId=${orderId}; etapa=${stage}; evento=${eventId ?? "manual"}; ${reason}`;
    console.error("[Suitable sync_failed]", { orderId, eventId, stage, error: msg });
    try {
      await prisma.suitableOrderInbox.upsert({
        where: { suitableOrderId: orderId },
        create: {
          suitableOrderId: orderId, lastEventId: eventId, lastEventType: type,
          fetchError: msg,
        },
        update: { fetchError: msg, lastEventId: eventId, lastEventType: type },
      });
    } catch (persistenceError) {
      console.error("[Suitable error_persistence_failed]", {
        orderId, eventId, stage: "persist_fetch_error",
        error: suitableDiagnosticExcerpt(persistenceError instanceof Error ? persistenceError.message : String(persistenceError)),
        originalError: msg,
      });
    }
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
        select: { suitableOrderId: true, status: true, fetchError: true },
      })
    ).filter((k) => k.status !== "pending" || !k.fetchError).map((k) => k.suitableOrderId)
  );
  const missing = [...new Set(seen)].filter((id) => !known.has(id)).slice(0, maxNew);
  let recovered = 0;
  for (const id of missing) {
    if ((await syncInboxOrder(id, null, "reconcile")).ok) recovered++;
  }
  return { checked: total, missing: missing.length, recovered };
}
