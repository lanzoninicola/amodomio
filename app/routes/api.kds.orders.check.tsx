import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { getDoughStock } from "~/domain/kds/dough-stock.server";
import {
  emptyReservation,
  storedCounts,
} from "~/domain/kds/import-order.server";
import {
  countOrderItemSizes,
  KDS_PIZZA_SIZES,
  parseOrderItems,
} from "~/domain/kds/order-items";
import { ymdToDateInt } from "~/domain/kds/utils/date";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ ok: false, error: "Método inválido." }, { status: 405 });
  const limit = restApi.rateLimitCheck(request, { bucket: "kds-import-check" });
  if (!limit.success)
    return json(
      { ok: false, error: "Aguarde um minuto para consultar novamente." },
      { status: 429 }
    );
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200)
    return json(
      { ok: false, error: "Confira a chave da API." },
      { status: auth.status === 500 ? 500 : 401 }
    );
  let body, counts;
  try {
    body = await request.json();
    const parsed = new Date(body.date + "T12:00:00.000Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== body.date ||
      body.date.startsWith("0000") ||
      !Number.isInteger(body.commandNumber) ||
      body.commandNumber < 1 ||
      body.commandNumber > 2147483647
    )
      throw new Error();
    counts = countOrderItemSizes(parseOrderItems(body.orderItems));
  } catch {
    return json(
      {
        ok: false,
        error: "Confira data, comanda e tamanhos antes de consultar.",
      },
      { status: 400 }
    );
  }
  const dateInt = ymdToDateInt(body.date);
  const [header, rows, stock] = await Promise.all([
    prisma.kdsDailyOrder.findUnique({
      where: { dateInt },
      select: { operationStatus: true },
    }),
    prisma.kdsDailyOrderDetail.findMany({ where: { dateInt } }),
    getDoughStock(dateInt),
  ]);
  const matches = rows.filter(
    (row) => row.commandNumber === body.commandNumber
  );
  const exists =
    matches.length > 1 ||
    (matches.length === 1 && !emptyReservation(matches[0]));
  const available = stock
    ? Object.fromEntries(
        KDS_PIZZA_SIZES.map((size) => [
          size,
          Math.max(
            0,
            stock.effective[size] -
              rows.reduce(
                (sum, row) =>
                  sum +
                  (matches.length === 1 && row === matches[0] && !row.deletedAt
                    ? 0
                    : storedCounts(row.size)[size]),
                0
              )
          ),
        ])
      )
    : null;
  const shortages = available
    ? KDS_PIZZA_SIZES.filter(
        (size) => counts[size] > 0 && counts[size] > available[size]
      )
    : [];
  const dayStatus = header?.operationStatus?.toUpperCase() || "MISSING";
  return json(
    {
      ok: true,
      check: {
        exists,
        status: matches.length === 1 && exists ? matches[0].status : null,
        available,
        shortages,
        dayStatus,
        canSend:
          matches.length <= 1 &&
          !matches[0]?.deletedAt &&
          !shortages.length &&
          ["OPENED", "REOPENED", "CLOSED"].includes(dayStatus),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
