import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { ensureHeader } from "~/domain/kds/server/repository.server";
import { emptyReservation } from "~/domain/kds/import-order.server";
import { parseOrderItems } from "~/domain/kds/order-items";
import { syncKdsOrderHistory } from "~/domain/crm/order-history.server";
import { ymdToDateInt, ymdToUtcNoon } from "~/domain/kds/utils/date";
import { mapSuitableOrder } from "./map-order";
import { prepareSuitableKdsOrder } from "./prepare-kds-order.server";
import { getSuitableSettings } from "./suitable-settings.server";

export function suitableOrderDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Compartilhado pelo webhook, recuperação e ação administrativa legada. */
export async function importSuitableInboxOrder(inboxId: string, requestedDay?: string) {
  if ((await getSuitableSettings()).paused) return { skipped: true as const, reason: "paused" };
  const inbox = await prisma.suitableOrderInbox.findUnique({ where: { id: inboxId } });
  if (!inbox || inbox.status !== "pending" || !inbox.details) return { skipped: true as const, reason: "not_pending" };
  const fill = mapSuitableOrder(inbox.details as any);
  if (fill.commandNumber === null) throw new Error("Número do pedido Suitable ausente ou inválido.");
  const day = requestedDay ?? suitableOrderDay(inbox.createdAt);
  const dateInt = ymdToDateInt(day);
  const hasSizes = Object.values(fill.sizes).some(n => n > 0);
  let storedItems: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  const noteLines = [...fill.notes];
  try { storedItems = parseOrderItems(fill.orderItems) as unknown as Prisma.InputJsonValue; }
  catch { noteLines.unshift(...fill.orderItems.map(i => `${i.quantity}x ${i.name}${i.flavors.length ? ` (${i.flavors.join("; ")})` : ""}`)); }
  const header = await ensureHeader(dateInt, ymdToUtcNoon(day));
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM suitable_order_inbox WHERE id = ${inboxId} FOR UPDATE`;
    const current = await tx.suitableOrderInbox.findUnique({ where: { id: inboxId } });
    if (!current || current.status !== "pending") return { skipped: true as const, reason: "not_pending" };
    if ((await tx.suitableSettings.findUnique({ where: { id: "default" } }))?.paused) return { skipped: true as const, reason: "paused" };
    const target = await prepareSuitableKdsOrder(tx, header.id, dateInt, fill.commandNumber!, emptyReservation);
    const updated = await tx.kdsDailyOrderDetail.update({
      where: { id: target.id },
        data: {
          commandNumber: fill.commandNumber,
          channel: fill.channel,
          customerName: fill.customerName || null,
          customerPhone: fill.customerPhone || null,
          orderAmount: new Prisma.Decimal(fill.orderAmount.toFixed(2)),
          hasMoto: fill.hasMoto,
          motoValue: new Prisma.Decimal(fill.motoValue.toFixed(2)),
          takeAway: fill.takeAway,
          isCreditCard: fill.isCreditCard,
          isCash: fill.isCash,
          isOtherPaymentMethod: fill.isOtherPaymentMethod,
          size: JSON.stringify(fill.sizes),
          orderItems: storedItems,
          suitableOrderId: fill.suitableOrderId,
          deliveryAddress: fill.address,
          changeFor:
            fill.changeForValue != null
              ? new Prisma.Decimal(fill.changeForValue.toFixed(2))
              : null,
          notes: noteLines.join("\n").slice(0, 2000) || null,
          paidOnline: fill.paid,
          // sem tamanho detectado: mantém "pendente" para conferência manual
          ...(hasSizes && fill.unmappedItems.length === 0
            ? { status: "novoPedido", novoPedidoAt: new Date() }
            : {}),
        },
    });
    await tx.suitableOrderInbox.update({ where: { id: inboxId }, data: { status: "imported", importedRowId: updated.id, fetchError: null } });
    await syncKdsOrderHistory(tx, updated);
    const total = await tx.kdsDailyOrderDetail.aggregate({ where: { dateInt }, _sum: { orderAmount: true } });
    await tx.kdsDailyOrder.update({ where: { id: header.id }, data: { totOrdersAmount: total._sum.orderAmount ?? 0 } });
    return { skipped: false as const, id: updated.id, commandNumber: updated.commandNumber, dateInt };
  });
}
