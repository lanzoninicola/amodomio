import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { ensureHeader, getMaxes, recalcHeaderTotal } from "~/domain/kds/server";
import { todayLocalYMD, ymdToDateInt, ymdToUtcNoon } from "~/domain/kds/utils/date";

type SizeCounts = {
  F: number;
  M: number;
  P: number;
  I: number;
  FT: number;
};

type KdsOrderPayload = {
  date?: string;
  commandNumber?: number | null;
  orderAmount?: number;
  channel?: string;
  sizes?: Partial<SizeCounts>;
  size?: string;
  hasMoto?: boolean;
  motoValue?: number;
  takeAway?: boolean;
  deliveryZoneId?: string | null;
  isCreditCard?: boolean;
  isVendaLivre?: boolean;
  customerName?: string;
  customerPhone?: string;
  status?: string;
};

const RATE_LIMIT_BUCKET = "kds-orders";

function toDecimal(value: unknown): Prisma.Decimal {
  const raw = String(value ?? "0").replace(",", ".");
  const n = Number(raw);
  return new Prisma.Decimal(Number.isFinite(n) ? n.toFixed(2) : "0");
}

function toBool(value: unknown): boolean {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(v)) return true;
    if (["false", "0", "off", "no"].includes(v)) return false;
  }
  return false;
}

function normalizeSizes(payload: KdsOrderPayload): SizeCounts {
  if (typeof payload.size === "string" && payload.size.trim()) {
    try {
      const parsed = JSON.parse(payload.size);
      return {
        F: Number(parsed?.F ?? 0) || 0,
        M: Number(parsed?.M ?? 0) || 0,
        P: Number(parsed?.P ?? 0) || 0,
        I: Number(parsed?.I ?? 0) || 0,
        FT: Number(parsed?.FT ?? 0) || 0,
      };
    } catch {
      return { F: 0, M: 0, P: 0, I: 0, FT: 0 };
    }
  }

  const s = payload.sizes ?? {};
  return {
    F: Number(s.F ?? 0) || 0,
    M: Number(s.M ?? 0) || 0,
    P: Number(s.P ?? 0) || 0,
    I: Number(s.I ?? 0) || 0,
    FT: Number(s.FT ?? 0) || 0,
  };
}

const stringifySize = (c: SizeCounts) => JSON.stringify(c);

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  return json({ error: "method_not_allowed" }, { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
  const rateLimit = restApi.rateLimitCheck(request, { bucket: RATE_LIMIT_BUCKET });
  if (!rateLimit.success) {
    const retrySeconds = rateLimit.retryIn ? Math.ceil(rateLimit.retryIn / 1000) : 60;
    return json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(retrySeconds) } }
    );
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  let body: KdsOrderPayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const date = typeof body?.date === "string" && body.date.trim() ? body.date.trim() : todayLocalYMD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "invalid_date_format", message: "Use YYYY-MM-DD" }, { status: 400 });
  }

  const dateInt = ymdToDateInt(date);
  if (!Number.isFinite(dateInt)) {
    return json({ error: "invalid_date" }, { status: 400 });
  }

  const isVendaLivre = toBool(body?.isVendaLivre);
  const rawCmd = body?.commandNumber;
  const cmd = isVendaLivre ? null : (rawCmd === null || rawCmd === undefined ? null : Number(rawCmd));

  if (!isVendaLivre && (cmd === null || !Number.isFinite(cmd))) {
    return json({ error: "invalid_command_number" }, { status: 400 });
  }

  const header = await ensureHeader(dateInt, ymdToUtcNoon(date));
  const headerStatus = await prisma.kdsDailyOrder.findUnique({
    where: { id: header.id },
    select: { operationStatus: true, openedAt: true },
  });

  if (headerStatus?.operationStatus === "CLOSED") {
    return json({ error: "day_closed" }, { status: 403 });
  }

  if (!headerStatus?.operationStatus || headerStatus.operationStatus === "pending") {
    await prisma.kdsDailyOrder.update({
      where: { id: header.id },
      data: { operationStatus: "OPENED", openedAt: headerStatus?.openedAt ?? new Date() },
    });
  }

  if (!isVendaLivre && cmd != null) {
    const dup = await prisma.kdsDailyOrderDetail.findFirst({
      where: { dateInt, commandNumber: cmd },
      select: { id: true },
    });
    if (dup) {
      return json({ error: "duplicate_command_number", commandNumber: cmd }, { status: 400 });
    }
  }

  const deliveryZoneIdRaw =
    typeof body?.deliveryZoneId === "string" && body.deliveryZoneId.trim()
      ? body.deliveryZoneId.trim()
      : null;
  if (deliveryZoneIdRaw) {
    const exists = await prisma.deliveryZone.findUnique({
      where: { id: deliveryZoneIdRaw },
      select: { id: true },
    });
    if (!exists) {
      return json({ error: "invalid_delivery_zone_id", deliveryZoneId: deliveryZoneIdRaw }, { status: 400 });
    }
  }

  const { maxSort } = await getMaxes(dateInt);

  const sizeCounts = normalizeSizes(body ?? {});
  const anySize = (sizeCounts.F + sizeCounts.M + sizeCounts.P + sizeCounts.I + sizeCounts.FT) > 0;
  const amountDecimal = toDecimal(body?.orderAmount);
  const amountGtZero = (amountDecimal as any)?.gt
    ? (amountDecimal as any).gt(new Prisma.Decimal(0))
    : Number(String(amountDecimal)) > 0;

  const requestedStatus = typeof body?.status === "string" ? body.status.trim() : "";
  const autoStatus = amountGtZero && anySize ? "novoPedido" : "pendente";
  const status = requestedStatus || autoStatus;

  const sortOrderIndex = (maxSort ?? 0) + 1000;

  const created = await prisma.kdsDailyOrderDetail.create({
    data: {
      orderId: header.id,
      dateInt,
      commandNumber: cmd,
      isVendaLivre,
      sortOrderIndex,
      orderAmount: amountDecimal,
      channel: typeof body?.channel === "string" ? body.channel.trim() : "",
      hasMoto: toBool(body?.hasMoto),
      motoValue: toDecimal(body?.motoValue),
      takeAway: toBool(body?.takeAway),
      size: stringifySize(sizeCounts),
      deliveryZoneId: deliveryZoneIdRaw,
      isCreditCard: toBool(body?.isCreditCard),
      customerName: typeof body?.customerName === "string" && body.customerName.trim()
        ? body.customerName.trim()
        : null,
      customerPhone: typeof body?.customerPhone === "string" && body.customerPhone.trim()
        ? body.customerPhone.trim()
        : null,
      status,
      ...(status === "novoPedido" ? { novoPedidoAt: new Date() } : {}),
    },
    select: { id: true, commandNumber: true, status: true },
  });

  await recalcHeaderTotal(dateInt);

  return json({
    ok: true,
    id: created.id,
    commandNumber: created.commandNumber,
    status: created.status,
    date,
    dateInt,
  });
  } catch (e: any) {
    if (e?.code === "P2003") {
      const field = typeof e?.meta?.field_name === "string" ? e.meta.field_name : undefined;
      return json(
        { error: "foreign_key_violation", field, message: "Chave estrangeira inválida." },
        { status: 400 }
      );
    }
    return json(
      { error: "unexpected_error", message: e?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
