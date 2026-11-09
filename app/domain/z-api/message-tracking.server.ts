import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "@config/env";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import {
  isConfirmedSent,
  mergeMessageStatus,
  providerMessageIds,
  type MessageStatus,
} from "./message-status";

const OUTBOUND = "zapi-outbound";
const CALLBACK = "zapi-confirmation";
type CrmInput = {
  phone: string;
  source: string;
  messageText?: string | null;
  payload?: Record<string, unknown>;
};
type TrackingData = {
  instanceId: string;
  providerIds: string[];
  status: MessageStatus;
  error: string | null;
  requestText?: string;
  response?: Record<string, unknown>;
  crm?: CrmInput;
};

// All mutations for this instance serialize in PostgreSQL, across serverless processes.
// The provider request happens outside this short transaction.
async function locked<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`zapi-tracking:${env.zapiInstanceId}`}))`;
      return work(tx);
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}

async function reconcile(
  tx: Prisma.TransactionClient,
  id: string,
  data: TrackingData
) {
  // Delivery may introduce the WhatsApp ID after acceptance returned only zaapId.
  for (let pass = 0; pass < 3 && data.providerIds.length; pass++) {
    const callbacks = await tx.wppEvent.findMany({
      where: {
        type: CALLBACK,
        AND: [
          { payload: { path: ["instanceId"], equals: data.instanceId } },
          {
            OR: data.providerIds.map((providerId) => ({
              payload: { path: ["providerIds"], array_contains: [providerId] },
            })),
          },
        ],
      },
    });
    const count = data.providerIds.length;
    for (const callback of callbacks) {
      const confirmation = callback.payload as unknown as TrackingData;
      data.status = mergeMessageStatus(data.status, confirmation.status);
      data.providerIds = [
        ...new Set([...data.providerIds, ...confirmation.providerIds]),
      ];
      if (confirmation.error && data.status === "failed")
        data.error = confirmation.error;
    }
    if (count === data.providerIds.length) break;
  }
  if (isConfirmedSent(data.status)) data.error = null;
  await tx.wppEvent.update({
    where: { id },
    data: { payload: data as unknown as Prisma.InputJsonValue },
  });
  if (data.crm) {
    const phoneE164 = normalize_phone_e164_br(data.crm.phone);
    const customer = phoneE164
      ? await tx.crmCustomer.findUnique({
          where: { phone_e164: phoneE164 },
          select: { id: true },
        })
      : null;
    if (customer) {
      const eventType = isConfirmedSent(data.status)
        ? "WHATSAPP_SENT"
        : data.status === "failed"
        ? "WHATSAPP_FAILED"
        : "WHATSAPP_PENDING";
      const payload = {
        ...data.crm.payload,
        action: eventType.toLowerCase(),
        phone: data.crm.phone,
        phone_e164: phoneE164,
        messageText: data.crm.messageText || null,
        fromMe: true,
        trackingId: id,
        deliveryStatus: data.status,
        deliveryError: data.error,
      };
      const event = {
        event_type: eventType,
        external_id: data.providerIds[0] || id,
        source: data.crm.source,
        payload: payload as Prisma.InputJsonValue,
        payload_raw: JSON.stringify(payload),
      };
      await tx.crmCustomerEvent.upsert({
        where: { id },
        create: { id, customer_id: customer.id, ...event },
        update: event,
      });
    }
  }
  return data;
}

export async function beginTrackedMessage(
  phone?: string,
  requestText?: string
) {
  const id = randomUUID();
  await prisma.wppEvent.create({
    data: {
      id,
      phone: phone || null,
      direction: "outbound",
      type: OUTBOUND,
      payload: {
        instanceId: env.zapiInstanceId,
        providerIds: [],
        status: "unknown",
        error: null,
        ...(requestText ? { requestText } : {}),
      },
    },
  });
  return id;
}

export async function isTrackedOutboundEcho(
  phone: string,
  messageId?: string,
  messageText?: string
) {
  const matches: Prisma.WppEventWhereInput[] = [];
  if (messageId)
    matches.push({
      payload: { path: ["providerIds"], array_contains: [messageId] },
    });
  // A fromMe callback can precede the HTTP response that supplies provider IDs.
  if (messageText?.trim())
    matches.push({
      phone,
      createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
      AND: [
        { payload: { path: ["requestText"], equals: messageText.trim() } },
        {
          OR: ["unknown", "accepted"].map((status) => ({
            payload: { path: ["status"], equals: status },
          })),
        },
      ],
    });
  if (!matches.length) return false;
  return Boolean(
    await prisma.wppEvent.findFirst({
      where: {
        type: OUTBOUND,
        AND: [
          { payload: { path: ["instanceId"], equals: env.zapiInstanceId } },
          { OR: matches },
        ],
      },
      select: { id: true },
    })
  );
}

export async function finishTrackedMessage(
  id: string,
  status: MessageStatus,
  response?: Record<string, unknown>,
  error: string | null = null
) {
  return locked(async (tx) => {
    const record = await tx.wppEvent.findUniqueOrThrow({ where: { id } });
    const data = record.payload as unknown as TrackingData;
    data.status = mergeMessageStatus(data.status, status);
    data.error = error;
    if (response) {
      data.response = response;
      data.providerIds = [
        ...new Set([...data.providerIds, ...providerMessageIds(response)]),
      ];
    }
    return reconcile(tx, id, data);
  });
}

export async function attachTrackedCrmEvent(id: string, input: CrmInput) {
  return locked(async (tx) => {
    const record = await tx.wppEvent.findUnique({ where: { id } });
    if (!record || record.type !== OUTBOUND)
      throw new Error("Tracked WhatsApp message not found");
    const data = record.payload as unknown as TrackingData;
    data.crm = input;
    await reconcile(tx, id, data);
    return { ok: true as const, trackingId: id };
  });
}

export async function recordMessageConfirmation(input: {
  ids: string[];
  status: MessageStatus;
  error: string | null;
}) {
  return locked(async (tx) => {
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          env.zapiInstanceId,
          [...input.ids].sort(),
          input.status,
          input.error,
        ])
      )
      .digest("hex");
    await tx.wppEvent.upsert({
      where: { id: `zapi-callback-${key}` },
      update: {},
      create: {
        id: `zapi-callback-${key}`,
        direction: "outbound",
        type: CALLBACK,
        payload: {
          instanceId: env.zapiInstanceId,
          providerIds: input.ids,
          status: input.status,
          error: input.error,
        },
      },
    });
    const records = await tx.wppEvent.findMany({
      where: {
        type: OUTBOUND,
        AND: [
          { payload: { path: ["instanceId"], equals: env.zapiInstanceId } },
          {
            OR: input.ids.map((id) => ({
              payload: { path: ["providerIds"], array_contains: [id] },
            })),
          },
        ],
      },
    });
    for (const record of records)
      await reconcile(tx, record.id, record.payload as unknown as TrackingData);
  });
}

export async function getTrackedMessage(id: string) {
  const record = await prisma.wppEvent.findUnique({ where: { id } });
  if (!record || record.type !== OUTBOUND) return null;
  const data = record.payload as unknown as TrackingData;
  if (data.instanceId !== env.zapiInstanceId) return null;
  return {
    trackingId: id,
    status: data.status,
    confirmed: isConfirmedSent(data.status),
    messageId: data.response?.messageId || data.response?.id || null,
    error: data.error,
    createdAt: record.createdAt.toISOString(),
    confirmationOverdue:
      ["unknown", "accepted"].includes(data.status) &&
      Date.now() - record.createdAt.getTime() > 5 * 60_000,
  };
}

export async function listTrackedMessages() {
  const records = await prisma.wppEvent.findMany({
    where: {
      type: OUTBOUND,
      payload: { path: ["instanceId"], equals: env.zapiInstanceId },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return records.map((record) => {
    const data = record.payload as unknown as TrackingData;
    return {
      trackingId: record.id,
      phone: record.phone,
      status: data.status,
      error: data.error,
      createdAt: record.createdAt.toISOString(),
      confirmationOverdue:
        ["unknown", "accepted"].includes(data.status) &&
        Date.now() - record.createdAt.getTime() > 5 * 60_000,
    };
  });
}
