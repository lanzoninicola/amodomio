import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import {
  ensureHeader,
  getMaxes,
  getOrderForApiByCommandNumber,
  getOrderForApiById,
  listOrdersForApiByDate,
  recalcHeaderTotal,
  type KdsOrderApiRow,
  setOrderStatus,
  type KdsStatus,
} from "~/domain/kds/server";
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

type KdsOrderStatusUpdatePayload = {
  id?: string;
  date?: string;
  commandNumber?: number | string | null;
  status?: string;
};

const RATE_LIMIT_BUCKET = "kds-orders";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPDATABLE_KDS_STATUSES: readonly KdsStatus[] = [
  "novoPedido",
  "emProducao",
  "aguardandoForno",
  "assando",
  "finalizado",
] as const;

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

function checkApiAccess(request: Request) {
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

  return null;
}

function parseDateOrResponse(raw: unknown) {
  const date =
    typeof raw === "string" && raw.trim()
      ? raw.trim()
      : todayLocalYMD();
  if (!DATE_RE.test(date)) {
    return {
      error: json({ error: "invalid_date_format", message: "Use YYYY-MM-DD" }, { status: 400 }),
    };
  }

  const dateInt = ymdToDateInt(date);
  if (!Number.isFinite(dateInt)) {
    return { error: json({ error: "invalid_date" }, { status: 400 }) };
  }

  return { date, dateInt };
}

function parseCommandNumberOrResponse(raw: string | null) {
  if (raw == null || raw.trim() === "") return { commandNumber: null };
  const commandNumber = Number(raw);
  if (!Number.isFinite(commandNumber)) {
    return { error: json({ error: "invalid_command_number" }, { status: 400 }) };
  }
  return { commandNumber };
}

function parseSizeValue(raw: string | null): SizeCounts | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      F: Number(parsed?.F ?? 0) || 0,
      M: Number(parsed?.M ?? 0) || 0,
      P: Number(parsed?.P ?? 0) || 0,
      I: Number(parsed?.I ?? 0) || 0,
      FT: Number(parsed?.FT ?? 0) || 0,
    };
  } catch {
    return null;
  }
}

function serializeOrder(row: KdsOrderApiRow) {
  return {
    id: row.id,
    orderId: row.orderId,
    dateInt: row.dateInt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deliveredAt: row.deliveredAt,
    commandNumber: row.commandNumber,
    size: row.size,
    sizes: parseSizeValue(row.size ?? null),
    hasMoto: row.hasMoto,
    motoValue: Number(row.motoValue ?? 0),
    orderAmount: Number(row.orderAmount ?? 0),
    channel: row.channel ?? "",
    status: row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    takeAway: row.takeAway,
    requestedForOven: row.requestedForOven,
    sortOrderIndex: row.sortOrderIndex,
    isVendaLivre: row.isVendaLivre,
    isCreditCard: row.isCreditCard,
    novoPedidoAt: row.novoPedidoAt,
    emProducaoAt: row.emProducaoAt,
    aguardandoFornoAt: row.aguardandoFornoAt,
    assandoAt: row.assandoAt,
    finalizadoAt: row.finalizadoAt,
    deliveryZoneId: row.deliveryZoneId,
    deliveryZone: row.DeliveryZone
      ? {
          id: row.DeliveryZone.id,
          name: row.DeliveryZone.name,
          city: row.DeliveryZone.city,
          state: row.DeliveryZone.state,
          zipCode: row.DeliveryZone.zipCode,
        }
      : null,
  };
}

async function handleListOrders(request: Request) {
  const accessError = checkApiAccess(request);
  if (accessError) return accessError;

  const url = new URL(request.url);
  const dateParsed = parseDateOrResponse(url.searchParams.get("date"));
  if ("error" in dateParsed) return dateParsed.error;

  const cmdParsed = parseCommandNumberOrResponse(url.searchParams.get("commandNumber"));
  if ("error" in cmdParsed) return cmdParsed.error;

  const { date, dateInt } = dateParsed;
  const { commandNumber } = cmdParsed;

  if (commandNumber != null) {
    const row = await getOrderForApiByCommandNumber(dateInt, commandNumber);

    if (!row) {
      return json(
        { error: "order_not_found", date, dateInt, commandNumber },
        { status: 404 }
      );
    }

    return json({
      ok: true,
      mode: "single",
      date,
      dateInt,
      commandNumber,
      order: serializeOrder(row),
    });
  }

  const rows = await listOrdersForApiByDate(dateInt);

  return json({
    ok: true,
    mode: "list",
    date,
    dateInt,
    count: rows.length,
    orders: rows.map(serializeOrder),
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  return handleListOrders(request);
}

async function handleCreateOrder(request: Request) {
  const accessError = checkApiAccess(request);
  if (accessError) return accessError;

  let body: KdsOrderPayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const dateParsed = parseDateOrResponse(body?.date);
  if ("error" in dateParsed) return dateParsed.error;
  const { date, dateInt } = dateParsed;

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
      where: { dateInt, commandNumber: cmd, deletedAt: null },
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
      return json(
        { error: "invalid_delivery_zone_id", deliveryZoneId: deliveryZoneIdRaw },
        { status: 400 }
      );
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
      customerName:
        typeof body?.customerName === "string" && body.customerName.trim()
          ? body.customerName.trim()
          : null,
      customerPhone:
        typeof body?.customerPhone === "string" && body.customerPhone.trim()
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
}

async function handleUpdateOrderStatus(request: Request) {
  const accessError = checkApiAccess(request);
  if (accessError) return accessError;

  let body: KdsOrderStatusUpdatePayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const requestedStatus = typeof body?.status === "string" ? body.status.trim() : "";
  if (!requestedStatus || !UPDATABLE_KDS_STATUSES.includes(requestedStatus as KdsStatus)) {
    return json(
      { error: "invalid_status", allowed: UPDATABLE_KDS_STATUSES },
      { status: 400 }
    );
  }

  const id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : null;

  let target = id ? await getOrderForApiById(id) : null;

  if (!target) {
    const dateParsed = parseDateOrResponse(body?.date);
    if ("error" in dateParsed) return dateParsed.error;

    const rawCmd =
      body?.commandNumber === null || body?.commandNumber === undefined
        ? null
        : String(body.commandNumber);
    const cmdParsed = parseCommandNumberOrResponse(rawCmd);
    if ("error" in cmdParsed) return cmdParsed.error;

    if (cmdParsed.commandNumber == null) {
      return json(
        { error: "missing_target", message: "Informe `id` ou (`date` + `commandNumber`)." },
        { status: 400 }
      );
    }

    target = await getOrderForApiByCommandNumber(dateParsed.dateInt, cmdParsed.commandNumber);
  }

  if (!target) {
    return json({ error: "order_not_found" }, { status: 404 });
  }

  await setOrderStatus(target.id, requestedStatus as KdsStatus);

  const updated = await getOrderForApiById(target.id);
  if (!updated) {
    return json({ error: "order_not_found" }, { status: 404 });
  }

  return json({
    ok: true,
    mode: "status_updated",
    id: updated.id,
    commandNumber: updated.commandNumber,
    status: updated.status,
    order: serializeOrder(updated),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST" && request.method !== "PATCH") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    if (request.method === "PATCH") {
      return await handleUpdateOrderStatus(request);
    }
    return await handleCreateOrder(request);
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
