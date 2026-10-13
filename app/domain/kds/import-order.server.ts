import { syncKdsOrderHistory } from "~/domain/crm/order-history.server";
import { json } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { getDoughStock } from "./dough-stock.server";
import {
  countOrderItemSizes,
  KDS_PIZZA_SIZES,
  parseOrderItems,
} from "./order-items";
import { ymdToDateInt } from "./utils/date";
import { normalizeKdsChannel } from "./constants";

const failure = (error: string, message: string, status = 400, extra = {}) =>
  json({ ok: false, error, message, ...extra }, { status });
function validMoney(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 99999999.99 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001
  );
}
export function storedCounts(size: string | null | undefined) {
  try {
    const parsed = JSON.parse(size || "{}");
    return Object.fromEntries(
      KDS_PIZZA_SIZES.map((key) => [key, Number(parsed?.[key] ?? 0) || 0])
    );
  } catch {
    return Object.fromEntries(KDS_PIZZA_SIZES.map((key) => [key, 0]));
  }
}
function emptyStoredSizes(size: string | null | undefined) {
  if (!size) return true;
  try {
    const parsed = JSON.parse(size);
    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.entries(parsed).every(
        ([key, value]) =>
          KDS_PIZZA_SIZES.includes(key as (typeof KDS_PIZZA_SIZES)[number]) &&
          (value === 0 || value === "0")
      )
    );
  } catch {
    return false;
  }
}
// A reserved row is reusable only while it has no order/customer/production data.
export function emptyReservation(
  row: Prisma.KdsDailyOrderDetailGetPayload<{}>
) {
  return (
    row.status === "pendente" &&
    !row.deletedAt &&
    !row.isVendaLivre &&
    Number(row.orderAmount) === 0 &&
    Number(row.motoValue) === 0 &&
    !row.orderItems &&
    !row.customerName?.trim() &&
    !row.customerPhone?.trim() &&
    !row.channel?.trim() &&
    !row.hasMoto &&
    !row.takeAway &&
    !row.deliveryZoneId &&
    !row.requestedForOven &&
    !row.isCreditCard &&
    !row.isCash &&
    !row.isOtherPaymentMethod &&
    !row.novoPedidoAt &&
    !row.emProducaoAt &&
    !row.aguardandoFornoAt &&
    !row.assandoAt &&
    !row.finalizadoAt &&
    !row.deliveredAt &&
    emptyStoredSizes(row.size)
  );
}

/** Imported snapshots have stricter rules; the legacy API remains unchanged. */
export async function createImportedOrder(body: Record<string, unknown>) {
  let items;
  try {
    items = parseOrderItems(body.orderItems);
  } catch (error) {
    return failure(
      "invalid_order_items",
      error instanceof Error ? error.message : "Confira os itens."
    );
  }
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const parsedDate = new Date(`${date}T12:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    date.startsWith("0000")
  )
    return failure("invalid_date", "Informe uma data válida para o pedido.");
  const dateInt = ymdToDateInt(date);
  const commandNumber = body.commandNumber;
  if (
    typeof commandNumber !== "number" ||
    !Number.isInteger(commandNumber) ||
    commandNumber < 1 ||
    commandNumber > 2147483647 ||
    (body.isVendaLivre !== undefined && body.isVendaLivre !== false)
  )
    return failure(
      "invalid_command_number",
      "Informe uma comanda inteira e positiva. Importação não é venda livre."
    );
  if (!validMoney(body.orderAmount))
    return failure(
      "invalid_order_amount",
      "Informe um total válido, não negativo, com até duas casas decimais."
    );
  if (
    typeof body.takeAway !== "boolean" ||
    (body.hasMoto !== undefined &&
      (typeof body.hasMoto !== "boolean" || body.hasMoto === body.takeAway))
  )
    return failure(
      "invalid_delivery",
      "Confira a indicação de entrega ou retirada."
    );
  const takeAway = body.takeAway;
  const motoValue =
    body.motoValue === undefined && takeAway ? 0 : body.motoValue;
  if (!validMoney(motoValue) || motoValue > body.orderAmount)
    return failure(
      "invalid_delivery_fee",
      "A taxa deve ser válida, não negativa e não superar o total do pedido."
    );
  const zoneId =
    typeof body.deliveryZoneId === "string" ? body.deliveryZoneId.trim() : null;
  if ((takeAway && (motoValue !== 0 || zoneId)) || (!takeAway && !zoneId))
    return failure(
      "invalid_delivery",
      "Entrega exige bairro cadastrado; retirada não pode ter bairro ou taxa."
    );
  for (const [key, max] of [
    ["customerName", 200],
    ["customerPhone", 100],
    ["channel", 100],
  ] as const) {
    if (
      body[key] !== undefined &&
      (typeof body[key] !== "string" || body[key].length > max)
    )
      return failure(
        "invalid_customer",
        "Confira os dados do cliente e canal."
      );
  }
  const customerName =
    typeof body.customerName === "string"
      ? body.customerName.trim() || null
      : null;
  const customerPhone =
    typeof body.customerPhone === "string"
      ? body.customerPhone.replace(/\D/g, "") || null
      : null;
  if (customerPhone && customerPhone.length > 20)
    return failure("invalid_customer", "Confira o telefone do cliente.");
  for (const key of [
    "isCreditCard",
    "isCash",
    "isOtherPaymentMethod",
  ] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean")
      return failure(
        "invalid_payment_flags",
        "Confira os indicadores de pagamento."
      );
  }
  const counts = countOrderItemSizes(items);
  const status =
    body.orderAmount > 0 && KDS_PIZZA_SIZES.some((key) => counts[key] > 0)
      ? "novoPedido"
      : "pendente";
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize imports by day. Never create a header or open a pending day.
      await tx.$queryRaw`SELECT id FROM kds_daily_orders WHERE date_int = ${dateInt} FOR UPDATE`;
      const header = await tx.kdsDailyOrder.findUnique({
        where: { dateInt },
        select: { id: true, operationStatus: true },
      });
      const reopenedDay = header?.operationStatus?.toUpperCase() === "CLOSED";
      if (
        !header ||
        !["OPENED", "REOPENED", "CLOSED"].includes(
          header.operationStatus?.toUpperCase() || ""
        )
      )
        return failure(
          "day_not_open",
          "Abra o dia no Atendimento antes de importar pedidos.",
          409
        );
      if (
        zoneId &&
        !(await tx.deliveryZone.findUnique({
          where: { id: zoneId },
          select: { id: true },
        }))
      )
        return failure(
          "invalid_delivery_zone_id",
          "Selecione um bairro existente no KDS."
        );
      // Lock existing rows so an operator cannot fill a reserved slot between check and write.
      await tx.$queryRaw`SELECT id FROM kds_daily_order_details WHERE date_int = ${dateInt} FOR UPDATE`;
      const rows = await tx.kdsDailyOrderDetail.findMany({
        where: { dateInt },
      });
      const matches = rows.filter((row) => row.commandNumber === commandNumber);
      const updating =
        body.updateExisting === true &&
        matches.length === 1 &&
        !emptyReservation(matches[0]) &&
        !matches[0].deletedAt;
      if (
        matches.length > 1 ||
        (matches.length === 1 && !emptyReservation(matches[0]) && !updating)
      )
        return failure(
          "duplicate_command_number",
          "Já existe um pedido nesta comanda. Nenhum dado foi alterado.",
          409,
          { commandNumber }
        );
      await tx.$queryRaw`SELECT id FROM dough_daily_stock WHERE date_int = ${dateInt} FOR UPDATE`;
      const stock = await getDoughStock(dateInt, tx);
      if (stock) {
        // Match Atendimento: all existing sizes reserve dough, irrespective of status.
        const used = rows.reduce(
          (sum, row) => {
            if (updating && row.id === matches[0].id) return sum;
            const sizes = storedCounts(row.size);
            for (const key of KDS_PIZZA_SIZES) sum[key] += sizes[key];
            return sum;
          },
          { F: 0, M: 0, P: 0, I: 0, FT: 0 }
        );
        const shortages = KDS_PIZZA_SIZES.filter(
          (key) =>
            counts[key] > 0 && counts[key] > stock.effective[key] - used[key]
        );
        if (shortages.length)
          return failure(
            "insufficient_dough_stock",
            shortages
              .map(
                (key) =>
                  `${key}: solicitadas ${counts[key]}, disponíveis ${Math.max(
                    0,
                    stock.effective[key] - used[key]
                  )}`
              )
              .join("; "),
            409,
            { shortages }
          );
      }
      const maxSort = rows.reduce(
        (maximum, row) => Math.max(maximum, row.sortOrderIndex),
        0
      );
      if (!matches.length && maxSort > 2147482647)
        return failure(
          "invalid_sort_order",
          "Limite de ordenação do dia atingido."
        );
      const data = {
        orderId: header.id,
        dateInt,
        commandNumber,
        isVendaLivre: false,
        sortOrderIndex: matches[0]?.sortOrderIndex ?? maxSort + 1000,
        orderAmount: new Prisma.Decimal(body.orderAmount as number),
        motoValue: new Prisma.Decimal(motoValue),
        hasMoto: !takeAway,
        takeAway,
        deliveryZoneId: zoneId,
        channel: normalizeKdsChannel(
          typeof body.channel === "string" ? body.channel : ""
        ),
        customerName,
        customerPhone,
        orderItems: items,
        size: JSON.stringify(counts),
        status: updating ? matches[0].status : status,
        isCreditCard: body.isCreditCard === true,
        isCash: body.isCreditCard !== true && body.isCash === true,
        isOtherPaymentMethod:
          body.isCreditCard !== true &&
          body.isCash !== true &&
          body.isOtherPaymentMethod === true,
        ...(updating &&
        body.isCreditCard === undefined &&
        body.isCash === undefined &&
        body.isOtherPaymentMethod === undefined
          ? {
              isCreditCard: matches[0].isCreditCard,
              isCash: matches[0].isCash,
              isOtherPaymentMethod: matches[0].isOtherPaymentMethod,
            }
          : {}),
        novoPedidoAt: updating
          ? matches[0].novoPedidoAt
          : status === "novoPedido"
          ? new Date()
          : null,
      };
      const select = { id: true, commandNumber: true, status: true } as const;
      const created = matches.length
        ? await tx.kdsDailyOrderDetail.update({
            where: { id: matches[0].id },
            data,
            select,
          })
        : await tx.kdsDailyOrderDetail.create({ data, select });
      await syncKdsOrderHistory(tx, { ...data, id: created.id } as Prisma.KdsDailyOrderDetailGetPayload<{}>);
      const total = await tx.kdsDailyOrderDetail.aggregate({
        where: { dateInt },
        _sum: { orderAmount: true },
      });
      await tx.kdsDailyOrder.update({
        where: { id: header.id },
        data: {
          totOrdersAmount: total._sum.orderAmount ?? new Prisma.Decimal(0),
          ...(reopenedDay ? { operationStatus: "REOPENED" } : {}),
        },
      });
      return json({ ok: true, ...created, date, dateInt, reopenedDay });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    )
      return failure(
        "import_conflict",
        "Outro pedido alterou o dia. Confira a comanda no KDS antes de tentar novamente.",
        409
      );
    throw error;
  }
}
