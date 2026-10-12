import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  event: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  customer: { findUnique: vi.fn() },
  crm: { upsert: vi.fn() },
  lock: vi.fn(),
}));
vi.mock("@config/env", () => ({ env: { zapiInstanceId: "instance" } }));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { $transaction: db.transaction, wppEvent: db.event },
}));
import {
  attachTrackedCrmEvent,
  beginTrackedMessage,
  finishTrackedMessage,
  getTrackedMessage,
  recordMessageConfirmation,
} from "./message-tracking.server";

const records = new Map<string, any>();
const crmRecords = new Map<string, any>();
beforeEach(() => {
  records.clear();
  crmRecords.clear();
  vi.clearAllMocks();
  const clone = (value: any) => structuredClone(value);
  db.transaction.mockImplementation(async (work) =>
    work({
      wppEvent: db.event,
      crmCustomer: db.customer,
      crmCustomerEvent: db.crm,
      $queryRaw: db.lock,
    })
  );
  db.event.create.mockImplementation(async ({ data }) => {
    const record = { createdAt: new Date(), ...clone(data) };
    records.set(data.id, record);
    return clone(record);
  });
  db.event.findUnique.mockImplementation(async ({ where }) =>
    records.has(where.id) ? clone(records.get(where.id)) : null
  );
  db.event.findUniqueOrThrow.mockImplementation(async ({ where }) =>
    clone(records.get(where.id))
  );
  db.event.upsert.mockImplementation(async ({ where, create }) => {
    if (!records.has(where.id))
      records.set(where.id, { createdAt: new Date(), ...clone(create) });
    return clone(records.get(where.id));
  });
  db.event.update.mockImplementation(async ({ where, data }) => {
    const record = { ...records.get(where.id), ...clone(data) };
    records.set(where.id, record);
    return clone(record);
  });
  db.event.findMany.mockImplementation(async ({ where }) => {
    const ids = where.AND[1].OR.map(
      (condition: any) => condition.payload.array_contains[0]
    );
    return [...records.values()]
      .filter(
        (record) =>
          record.type === where.type &&
          record.payload.instanceId === where.AND[0].payload.equals &&
          record.payload.providerIds.some((id: string) => ids.includes(id))
      )
      .map(clone);
  });
  db.customer.findUnique.mockResolvedValue({ id: "customer-1" });
  db.crm.upsert.mockImplementation(async ({ where, create, update }) => {
    crmRecords.set(
      where.id,
      crmRecords.has(where.id)
        ? { ...crmRecords.get(where.id), ...clone(update) }
        : clone(create)
    );
  });
});
const crmInput = {
  phone: "5511999999999",
  source: "api.messages.text",
  messageText: "Olá",
};
const confirm = (
  ids: string[],
  status: "sent" | "failed" | "delivered" | "read",
  error: string | null = null
) => recordMessageConfirmation({ ids, status, error });

describe("durable message reconciliation", () => {
  it("records acceptance as pending and updates the same CRM row on sent/delivered/read", async () => {
    const id = await beginTrackedMessage(crmInput.phone);
    await finishTrackedMessage(id, "accepted", {
      messageId: "msg",
      zaapId: "queue",
    });
    await attachTrackedCrmEvent(id, crmInput);
    expect(crmRecords.get(id).event_type).toBe("WHATSAPP_PENDING");
    await confirm(["queue", "msg"], "sent");
    expect(crmRecords.get(id).event_type).toBe("WHATSAPP_SENT");
    await confirm(["msg"], "delivered");
    await confirm(["msg"], "read");
    await confirm(["msg"], "sent");
    expect(crmRecords.size).toBe(1);
    expect(crmRecords.get(id).payload.deliveryStatus).toBe("read");
    expect(await getTrackedMessage(id)).toMatchObject({
      status: "read",
      confirmed: true,
    });
    expect(db.lock).toHaveBeenCalled();
  });
  it("deduplicates callback retries and preserves failures over late sent ACKs", async () => {
    const id = await beginTrackedMessage(crmInput.phone);
    await finishTrackedMessage(id, "accepted", { messageId: "msg" });
    await attachTrackedCrmEvent(id, crmInput);
    await confirm(["msg"], "failed", "Phone does not exist");
    await confirm(["msg"], "failed", "Phone does not exist");
    expect(
      [...records.values()].filter(
        (record) => record.type === "zapi-confirmation"
      )
    ).toHaveLength(1);
    await confirm(["msg"], "sent");
    expect(crmRecords.get(id).event_type).toBe("WHATSAPP_FAILED");
    expect(await getTrackedMessage(id)).toMatchObject({
      status: "failed",
      confirmed: false,
      error: "Phone does not exist",
    });
  });
  it("reconciles callbacks received before the provider response, including new WhatsApp IDs", async () => {
    const id = await beginTrackedMessage(crmInput.phone);
    await confirm(["msg"], "read");
    await confirm(["queue", "msg"], "sent");
    const result = await finishTrackedMessage(id, "accepted", {
      zaapId: "queue",
    });
    await attachTrackedCrmEvent(id, crmInput);
    expect(result.status).toBe("read");
    expect(crmRecords.get(id).event_type).toBe("WHATSAPP_SENT");
  });
  it("tracks numbers outside the CRM and keeps unrelated messages independent", async () => {
    db.customer.findUnique.mockResolvedValue(null);
    const first = await beginTrackedMessage(crmInput.phone);
    const second = await beginTrackedMessage(crmInput.phone);
    await finishTrackedMessage(first, "accepted", { messageId: "one" });
    await finishTrackedMessage(second, "accepted", { messageId: "two" });
    await attachTrackedCrmEvent(first, crmInput);
    await confirm(["one"], "delivered");
    expect(await getTrackedMessage(first)).toMatchObject({
      status: "delivered",
    });
    expect(await getTrackedMessage(second)).toMatchObject({
      status: "accepted",
    });
    expect(crmRecords.size).toBe(0);
  });
  it("flags overdue uncertainty without turning it into a failure", async () => {
    const id = await beginTrackedMessage(crmInput.phone);
    records.get(id).createdAt = new Date(Date.now() - 6 * 60_000);
    expect(await getTrackedMessage(id)).toMatchObject({
      status: "unknown",
      confirmed: false,
      confirmationOverdue: true,
    });
    expect(await getTrackedMessage("missing")).toBeNull();
  });
});
