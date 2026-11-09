import { beforeEach, describe, expect, it, vi } from "vitest";
const confirmation = vi.hoisted(() => vi.fn());
vi.mock("@config/env", () => ({
  env: { zapiInstanceId: "instance", webhookRateLimitPerMinute: 120 },
}));
vi.mock("./message-tracking.server", () => ({
  recordMessageConfirmation: confirmation,
}));
import { handleConfirmationWebhook } from "./confirmation-webhook.server";
import { parseMessageCallback, mergeMessageStatus } from "./message-status";
const payload = {
  instanceId: "instance",
  type: "MessageStatusCallback",
  ids: ["message-1"],
  status: "RECEIVED",
};
const request = (body: unknown = payload, secret = "secret") =>
  new Request(
    `https://app.test/webhooks/zapi/message-status?secret=${secret}`,
    { method: "POST", body: JSON.stringify(body) }
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ZAPI_WEBHOOK_SECRET", "secret");
});

describe("confirmation webhook", () => {
  it("requires a configured secret and rejects invalid credentials", async () => {
    expect(
      (
        await handleConfirmationWebhook(
          request(payload, "wrong"),
          "message-status"
        )
      ).status
    ).toBe(401);
    vi.stubEnv("ZAPI_WEBHOOK_SECRET", "");
    expect(
      (await handleConfirmationWebhook(request(), "message-status")).status
    ).toBe(503);
    expect(confirmation).not.toHaveBeenCalled();
  });
  it("rejects another instance and malformed payloads", async () => {
    for (const body of [
      null,
      [],
      { ...payload, instanceId: "other" },
      { ...payload, ids: [] },
    ]) {
      expect(
        (await handleConfirmationWebhook(request(body), "message-status"))
          .status
      ).toBe(400);
    }
    expect(confirmation).not.toHaveBeenCalled();
  });
  it("accepts a batch of receipts", async () => {
    expect(
      (
        await handleConfirmationWebhook(
          request({ ...payload, ids: ["a", "b"] }),
          "message-status"
        )
      ).status
    ).toBe(200);
    expect(confirmation).toHaveBeenCalledWith({
      ids: ["a", "b"],
      status: "delivered",
      error: null,
    });
  });
  it("does not treat READ_BY_ME as customer read evidence", async () => {
    expect(
      (
        await handleConfirmationWebhook(
          request({ ...payload, status: "READ_BY_ME" }),
          "message-status"
        )
      ).status
    ).toBe(200);
    expect(confirmation).not.toHaveBeenCalled();
  });
  it("returns an error when persistence fails, rather than discarding confirmation", async () => {
    confirmation.mockRejectedValueOnce(new Error("db unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (await handleConfirmationWebhook(request(), "message-status")).status
    ).toBe(500);
    log.mockRestore();
  });
  it("interprets delivery errors and actual send acknowledgments", () => {
    expect(
      parseMessageCallback(
        {
          type: "DeliveryCallback",
          zaapId: "a",
          messageId: "b",
          error: "Phone does not exist",
        },
        "delivery"
      )
    ).toEqual({
      ids: ["b", "a"],
      status: "failed",
      error: "Phone does not exist",
    });
    expect(
      parseMessageCallback(
        { type: "DeliveryCallback", messageId: "b" },
        "delivery"
      )?.status
    ).toBe("sent");
  });
  it("prevents late ACKs and failures from downgrading read/received evidence", () => {
    expect(mergeMessageStatus("read", "sent")).toBe("read");
    expect(mergeMessageStatus("delivered", "failed")).toBe("delivered");
    expect(mergeMessageStatus("sent", "failed")).toBe("failed");
    expect(mergeMessageStatus("failed", "sent")).toBe("failed");
  });
});
