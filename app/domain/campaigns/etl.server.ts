import prismaClient from "~/lib/prisma/client.server";

// =============== Utils ===============
function normalizePhoneBR(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // Heurística simples p/ BR:
  // 11 dígitos = DDD+celular; 10 = DDD+fixo; 13 = 55+DDD+celular
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  // fallback: se já vier com +55
  if (raw.trim().startsWith("+55")) return raw.trim();
  return null;
}

function parseBRDateTimeToDate(dateBR?: string, time?: string): Date {
  // dateBR: "31/08/2025"; time: "22:04:17" (ou "22:04")
  // Converte para ISO assumindo fuso -03:00
  const [d, m, y] = (dateBR || "").split("/");
  const hhmmss = (time || "00:00:00").padEnd(8, ":00");
  // Monta "YYYY-MM-DDTHH:mm:ss-03:00"
  const iso = `${y}-${m}-${d}T${hhmmss}-03:00`;
  return new Date(iso);
}

function isFeeLike(txt?: string | null): boolean {
  if (!txt) return false;
  const t = txt.toLowerCase();
  return (
    t.includes("taxa") ||
    t.includes("entrega") ||
    t.includes("serviço") ||
    t.includes("servico")
  );
}

function isDiscountLike(txt?: string | null): boolean {
  if (!txt) return false;
  const t = txt.toLowerCase();
  return t.includes("desconto") || t.includes("cupom") || t.includes("promo");
}

// =============== ETL principal ===============
export async function upsertCustomerOrdersFromImport(source = "csv") {
  // 1) lê tudo da import (você pode filtrar por range/data se quiser)
  const rows = await prismaClient.importMogoVendaPorCliente.findMany({
    orderBy: [{ paidAtDate: "asc" }, { paidAtHour: "asc" }],
  });

  // 2) agrupa por pedido (chave estável de origem)
  type Row = (typeof rows)[number];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${source}::${r.orderNumber}::${r.paidAtDate}::${r.paidAtHour}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  let ordersUpserted = 0;

  // 3) processa cada pedido
  for (const [, list] of groups) {
    const first = list[0];

    const paidAt = parseBRDateTimeToDate(first.paidAtDate, first.paidAtHour);
    const phoneRaw = first.phone || null;
    const phoneE164 = normalizePhoneBR(phoneRaw);

    const totalAmount = list.reduce((acc, r) => acc + Number(r.amount), 0);

    // 4) UPSERT do cabeçalho (chave única alinhada ao @@unique do Prisma)
    const order = await prismaClient.customerOrder.upsert({
      where: {
        source_order_number_paid_at_date_paid_at_hour: {
          source,
          order_number: first.orderNumber,
          paid_at_date: first.paidAtDate,
          paid_at_hour: first.paidAtHour,
        },
      },
      update: {
        customer_name: first.customerName,
        phone_raw: phoneRaw,
        phone_e164: phoneE164,
        payment_type: first.paymentType,
        paid_at: paidAt,
        table_label: first.tableLabel ?? null,
        order_tag: first.orderTag ?? null,
        total_amount: totalAmount,
      },
      create: {
        source,
        order_number: first.orderNumber,
        customer_name: first.customerName,
        phone_raw: phoneRaw,
        phone_e164: phoneE164,
        payment_type: first.paymentType,
        paid_at_date: first.paidAtDate,
        paid_at_hour: first.paidAtHour,
        paid_at: paidAt,
        table_label: first.tableLabel ?? null,
        order_tag: first.orderTag ?? null,
        total_amount: totalAmount,
      },
      select: { id: true },
    });

    // 5) Itens — estratégia idempotente simples: apaga e recria do snapshot importado
    await prismaClient.customerOrderItem.deleteMany({
      where: { order_id: order.id },
    });
    await prismaClient.customerOrderItem.createMany({
      data: list.map((r) => ({
        order_id: order.id,
        product_name: r.productName,
        quantity: Number(r.quantity || 1),
        amount: r.amount,
        is_fee: isFeeLike(r.productName) || isFeeLike(r.paymentType),
        is_discount:
          isDiscountLike(r.productName) || isDiscountLike(r.paymentType),
      })),
    });

    ordersUpserted++;
  }

  return { ok: true, upserted: ordersUpserted, ordersFound: groups.size };
}
