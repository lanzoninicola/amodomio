import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { ymdToDateInt } from "~/domain/kds/utils/date";

function phone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ ok: false, error: "Método inválido." }, { status: 405 });
  const limit = restApi.rateLimitCheck(request, { bucket: "kds-order-status" });
  if (!limit.success)
    return json(
      { ok: false, error: "Aguarde para consultar novamente." },
      { status: 429 }
    );
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200)
    return json(
      { ok: false, error: "Confira a chave da API." },
      { status: auth.status === 500 ? 500 : 401 }
    );
  let body: {
    date: string;
    orders: { commandNumber: number; customerPhone: string }[];
  };
  try {
    body = await request.json();
    const parsed = new Date(body.date + "T12:00:00.000Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== body.date ||
      body.date.startsWith("0000") ||
      !Array.isArray(body.orders) ||
      !body.orders.length ||
      body.orders.length > 50 ||
      body.orders.some(
        (order) =>
          !Number.isInteger(order?.commandNumber) ||
          order.commandNumber < 1 ||
          order.commandNumber > 2147483647 ||
          typeof order.customerPhone !== "string" ||
          order.customerPhone.length > 30 ||
          !/^\d{10,11}$/.test(phone(order.customerPhone))
      )
    )
      throw new Error();
  } catch {
    return json(
      {
        ok: false,
        error: "Confira a data, os números dos pedidos e os telefones.",
      },
      { status: 400 }
    );
  }
  const rows = await prisma.kdsDailyOrderDetail.findMany({
    where: {
      dateInt: ymdToDateInt(body.date),
      deletedAt: null,
      commandNumber: {
        in: [...new Set(body.orders.map((order) => order.commandNumber))],
      },
    },
    select: { commandNumber: true, customerPhone: true },
  });
  return json(
    {
      ok: true,
      date: body.date,
      statuses: body.orders.map((order) => ({
        commandNumber: order.commandNumber,
        customerPhone: phone(order.customerPhone),
        exists: rows.some(
          (row) =>
            row.commandNumber === order.commandNumber &&
            phone(row.customerPhone || "") === phone(order.customerPhone)
        ),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
