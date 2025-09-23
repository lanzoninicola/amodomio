// ~/domain/campaigns/etl.server.ts

import prismaClient from "~/lib/prisma/client.server";

/* ======================= Utils ======================= */
function normalizePhoneBR(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;

  // Já começa com +55?
  if (t.startsWith("+55")) return t.replace(/\s+/g, "");

  // Só dígitos
  const digits = t.replace(/\D/g, "");
  // 13 com '55' na frente (55 + DDD + número)
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  // 10 (DDD+fixo) ou 11 (DDD+celular)
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

function onlyDigits(s?: string | null): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d || null;
}

function parseBRDateTimeToDate(dateBR?: string, time?: string): Date {
  // Ex.: "31/08/2025" + "22:04:17" -> Date (fuso -03)
  const [d, m, y] = (dateBR || "").split("/");
  if (!d || !m || !y) return new Date();
  const hhmmss = (time || "00:00:00").padEnd(8, ":00"); // se vier "22:04", vira "22:04:00"
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

/* ========== ETL 1: Import -> customer_order / customer_order_item ========== */
/**
 * Consolida pedidos normalizados (header + items) a partir da tabela de import.
 * - idempotente por (source, externalOrderNumber, paidAtDate, paidAtHour)
 * - apaga/recria itens do pedido na reexecução
 * - NÃO cria FK para Customer; relação futura será por telefone (phoneE164/dígitos)
 */
export async function upsertCustomerOrdersFromImport(source = "csv") {
  // Lê toda a import (você pode filtrar por período se quiser)
  const rows = await prismaClient.importMogoVendaPorCliente.findMany({
    orderBy: [{ paidAtDate: "asc" }, { paidAtHour: "asc" }],
  });

  type Row = (typeof rows)[number];
  const groups = new Map<string, Row[]>();

  // Agrupa por pedido (chave estável vinda do CSV)
  for (const r of rows) {
    const key = `${source}::${r.orderNumber}::${r.paidAtDate}::${r.paidAtHour}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  let ordersUpserted = 0;

  for (const [, list] of groups) {
    const first = list[0];

    const paidAt = parseBRDateTimeToDate(first.paidAtDate, first.paidAtHour);
    const phoneRaw = first.phone || null;
    const phoneE164 = normalizePhoneBR(phoneRaw);
    const totalAmount = list.reduce((acc, r) => acc + Number(r.amount), 0);

    // UPSERT do cabeçalho (CustomerOrder)
    const order = await prismaClient.customerOrder.upsert({
      where: {
        // <- nome do compound unique gerado pelo Prisma Client
        source_externalOrderNumber_paidAtDate_paidAtHour: {
          source,
          externalOrderNumber: first.orderNumber,
          paidAtDate: first.paidAtDate,
          paidAtHour: first.paidAtHour,
        },
      },
      update: {
        customerName: first.customerName,
        phoneRaw: phoneRaw,
        phoneE164: phoneE164,
        paymentType: first.paymentType,
        paidAt,
        tableLabel: first.tableLabel ?? null,
        orderTag: first.orderTag ?? null,
        totalAmount,
      },
      create: {
        source,
        externalOrderNumber: first.orderNumber,
        customerName: first.customerName,
        phoneRaw: phoneRaw,
        phoneE164: phoneE164,
        paymentType: first.paymentType,
        paidAtDate: first.paidAtDate,
        paidAtHour: first.paidAtHour,
        paidAt,
        tableLabel: first.tableLabel ?? null,
        orderTag: first.orderTag ?? null,
        totalAmount,
      },
      select: { id: true },
    });

    // Recria os itens do pedido (snapshot idempotente)
    await prismaClient.customerOrderItem.deleteMany({
      where: { orderId: order.id },
    });
    await prismaClient.customerOrderItem.createMany({
      data: list.map((r) => ({
        orderId: order.id,
        productName: r.productName,
        quantity: Number(r.quantity || 1),
        amount: r.amount,
        isFee: isFeeLike(r.productName) || isFeeLike(r.paymentType),
        isDiscount:
          isDiscountLike(r.productName) || isDiscountLike(r.paymentType),
      })),
    });

    ordersUpserted++;
  }

  return { ok: true, upserted: ordersUpserted, ordersFound: groups.size };
}

/* ========== ETL 2: customer_order -> customer (consolidação por telefone) ========== */
/**
 * Consolida/atualiza a base de clientes a partir da camada histórica de pedidos.
 * - usa telefone (E.164 ou dígitos) como chave lógica
 * - cria cliente quando não existir
 * - atualiza `lastOrderAt` com MAX(paidAt)
 * - atualiza `name` quando vier um nome melhor (não-vazio) do pedido
 */
export async function upsertCustomersFromErp() {
  // Telefones únicos com último pedido
  const orders = await prismaClient.customerOrder.groupBy({
    by: ["phoneE164"],
    _max: { paidAt: true },
    where: { phoneE164: { not: null } },
  });

  let upserted = 0;

  for (const o of orders) {
    const phoneE164 = o.phoneE164 as string; // not null pelo where
    const digits = onlyDigits(phoneE164); // para comparar com 'customer.phone' guardado como dígitos

    // Nome mais recente não vazio (preferimos do pedido mais recente)
    const latest = await prismaClient.customerOrder.findFirst({
      where: { phoneE164 },
      orderBy: { paidAt: "desc" },
      select: { customerName: true },
    });
    const bestName = (latest?.customerName || "").trim();

    // Busca cliente por telefone (assumindo que customer.phone guarda dígitos)
    const existing = await prismaClient.customer.findFirst({
      where: { phone: digits || undefined },
      select: { id: true, name: true, lastOrderAt: true },
    });

    if (!existing) {
      await prismaClient.customer.create({
        data: {
          name: bestName || null,
          phone: digits,
          lastOrderAt: o._max.paidAt ?? null,
        } as any,
      });
      upserted++;
    } else {
      // Atualiza nome (se vier um melhor) e lastOrderAt (máximo)
      await prismaClient.customer.update({
        where: { id: existing.id },
        data: {
          name: bestName || existing.name,
          lastOrderAt:
            o._max.paidAt &&
            existing.lastOrderAt &&
            o._max.paidAt < existing.lastOrderAt
              ? existing.lastOrderAt
              : o._max.paidAt ?? existing.lastOrderAt,
        } as any,
      });
      upserted++;
    }
  }

  return { ok: true, upserted };
}

/* ========== (Opcional) Sincronização rápida do lastOrderAt via SQL ========== */
export async function syncCustomersLastOrderAtFast() {
  // Ajuste conforme nomes de colunas reais no seu schema
  const sql = `
    UPDATE customer c
    SET last_order_at = sub.max_paid_at
    FROM (
      SELECT REPLACE(COALESCE(phone_e164, ''), ' ', '') AS phone_key,
             MAX(paid_at) AS max_paid_at
      FROM customer_order
      WHERE phone_e164 IS NOT NULL
      GROUP BY REPLACE(COALESCE(phone_e164, ''), ' ', '')
    ) sub
    WHERE REPLACE(COALESCE(c.phone, ''), ' ', '') = REPLACE(REGEXP_REPLACE(sub.phone_key, '\\D', '', 'g'), ' ', '');
  `;
  // @ts-ignore
  await prismaClient.$executeRawUnsafe(sql);
  return { ok: true };
}
