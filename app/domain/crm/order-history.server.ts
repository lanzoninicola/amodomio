import { Prisma, type KdsDailyOrderDetail } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { readStoredOrderItems } from "~/domain/kds/order-items";
import { normalize_phone_e164_br } from "./normalize-phone.server";
import { summarizePurchaseHistory } from "./purchase-history";

export async function resolveOrderCustomer(
  tx: Prisma.TransactionClient,
  phoneRaw: string | null,
  name: string | null
) {
  const phone = phoneRaw ? normalize_phone_e164_br(phoneRaw) : null;
  if (!phone) return null;
  // Existing profile data belongs to the CRM; an order must not overwrite it.
  return tx.crmCustomer.upsert({
    where: { phone_e164: phone },
    update: {},
    create: { phone_e164: phone, name: name?.trim() || null },
    select: { id: true, phone_e164: true },
  });
}

export async function syncKdsOrderHistory(
  tx: Prisma.TransactionClient,
  row: KdsDailyOrderDetail
) {
  const items = readStoredOrderItems(row.orderItems);
  if (!items.length) return;
  const customer = await resolveOrderCustomer(
    tx,
    row.customerPhone,
    row.customerName
  );
  const date = String(row.dateInt);
  const paidAtDate = `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(
    0,
    4
  )}`;
  const existing = await tx.customerOrder.findUnique({
    where: { kdsOrderId: row.id },
    select: { id: true },
  });
  const data = {
    customerId: customer?.id ?? null,
    customerName: row.customerName || "Sem nome",
    phoneRaw: row.customerPhone,
    phoneE164: customer?.phone_e164 ?? null,
    paymentType: row.isCreditCard ? "card" : row.isCash ? "cash" : "unknown",
    totalAmount: row.orderAmount,
    orderTag: row.commandNumber?.toString() ?? null,
  };
  const order = existing
    ? await tx.customerOrder.update({ where: { id: existing.id }, data })
    : await tx.customerOrder.create({
        data: {
          ...data,
          source: "suitable-kds",
          kdsOrderId: row.id,
          // Internal UUID keeps identity stable across comanda and telephone corrections.
          externalOrderNumber: row.id,
          paidAtDate,
          paidAtHour: "00:00:00",
          paidAt: new Date(
            `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(
              6,
              8
            )}T00:00:00-03:00`
          ),
        },
      });
  await tx.customerOrderItem.deleteMany({ where: { orderId: order.id } });
  await tx.customerOrderItem.createMany({
    data: items.map((item) => ({
      orderId: order.id,
      productName: item.name,
      quantity: item.quantity,
      size: item.size,
      flavors: item.flavors,
      notes: item.notes,
      // The integration supplies only the order total, never invent per-item prices.
      amount: null,
    })),
  });
}

export async function getCustomerPurchaseHistory(
  customerId: string,
  phone: string
) {
  const orders = await prisma.customerOrder.findMany({
    where: { OR: [{ customerId }, { customerId: null, phoneE164: phone }] },
    include: { items: true, kdsOrder: true },
    orderBy: { paidAt: "desc" },
  });
  const history = orders.map((order) => {
    const kds = order.kdsOrder;
    const active =
      order.source !== "suitable-kds" ||
      Boolean(kds && !kds.deletedAt && kds.status !== "pendente");
    const items = kds
      ? readStoredOrderItems(kds.orderItems)
      : order.items
          .filter((i) => !i.isFee && !i.isDiscount)
          .map((i) => ({
            name: i.productName,
            quantity: i.quantity,
            size: i.size,
            flavors: i.flavors,
            notes: i.notes,
          }));
    return {
      id: order.id,
      source: order.source,
      date: order.paidAt.toISOString(),
      number:
        kds?.commandNumber?.toString() ||
        order.orderTag ||
        order.externalOrderNumber,
      total: Number(kds?.orderAmount ?? order.totalAmount),
      active,
      items,
    };
  });
  return {
    summary: summarizePurchaseHistory(history),
    orders: history.slice(0, 50),
    totalHistory: history.length,
  };
}

/** Explicit maintenance operation; never runs from a loader. */
export async function backfillPurchaseHistory(apply = false) {
  const kdsRows = await prisma.kdsDailyOrderDetail.findMany({
    where: { orderItems: { not: Prisma.DbNull }, deletedAt: null },
  });
  const csvOrders = await prisma.customerOrder.findMany({
    where: {
      source: { not: "suitable-kds" },
      customerId: null,
      phoneE164: { not: null },
    },
  });
  const eligibleKds = kdsRows.filter(
    (row) => readStoredOrderItems(row.orderItems).length > 0
  );
  if (apply) {
    for (const row of eligibleKds)
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM kds_daily_order_details WHERE id = ${row.id} FOR UPDATE`;
        const current = await tx.kdsDailyOrderDetail.findUnique({
          where: { id: row.id },
        });
        if (current && !current.deletedAt)
          await syncKdsOrderHistory(tx, current);
      });
    for (const order of csvOrders)
      await prisma.$transaction(async (tx) => {
        const customer = await resolveOrderCustomer(
          tx,
          order.phoneE164,
          order.customerName
        );
        if (customer)
          await tx.customerOrder.update({
            where: { id: order.id },
            data: { customerId: customer.id, phoneE164: customer.phone_e164 },
          });
      });
  }
  return { apply, kdsOrders: eligibleKds.length, csvOrders: csvOrders.length };
}
