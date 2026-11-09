import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const tracking = vi.hoisted(() => ({ begin: vi.fn(), finish: vi.fn() }));
vi.mock("@config/env", () => ({
  env: {
    zapiBaseUrl: "https://provider.test",
    zapiInstanceId: "instance",
    zapiInstanceToken: "private-token",
    zapiClientToken: "private-client",
  },
}));
vi.mock("./message-tracking.server", () => ({
  beginTrackedMessage: tracking.begin,
  finishTrackedMessage: tracking.finish,
}));
import { zapiRequest, zapiInstancePath } from "./zapi-client.server";

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  tracking.begin.mockResolvedValue("tracking-1");
  tracking.finish.mockImplementation(async (_id, status) => ({ status }));
});
afterEach(() => vi.unstubAllGlobals());
const send = () =>
  zapiRequest("POST", `${zapiInstancePath}/send-text`, {
    phone: "5511999999999",
    message: "Olá",
  });

describe("Z-API connection and send acceptance", () => {
  it("blocks disconnected instances without POSTing or recording a sent message", async () => {
    fetchMock.mockResolvedValueOnce(reply({ connected: false }));
    await expect(send()).rejects.toMatchObject({
      status: 503,
      body: { code: "instance_disconnected" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(tracking.begin).not.toHaveBeenCalled();
  });
  it.each([{}, { connected: "true" }, null])(
    "fails closed on an invalid connection response: %j",
    async (body) => {
      fetchMock.mockResolvedValueOnce(reply(body));
      await expect(send()).rejects.toMatchObject({ status: 502 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
  it("fails closed when the connection query fails", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: "down" }, 503));
    await expect(send()).rejects.toMatchObject({ status: 503 });
    expect(tracking.begin).not.toHaveBeenCalled();
  });
  it("returns accepted, not confirmed sent, and preserves provider IDs", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockResolvedValueOnce(
        reply({ zaapId: "queue-1", messageId: "message-1" })
      );
    await expect(send()).resolves.toMatchObject({
      trackingId: "tracking-1",
      status: "accepted",
      confirmed: false,
      messageId: "message-1",
    });
    expect(tracking.finish).toHaveBeenCalledWith(
      "tracking-1",
      "accepted",
      { zaapId: "queue-1", messageId: "message-1" },
      undefined
    );
    expect(tracking.begin.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[1]
    );
  });
  it("does not POST if persistence is unavailable before sending", async () => {
    fetchMock.mockResolvedValueOnce(reply({ connected: true }));
    tracking.begin.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(send()).rejects.toThrow("database unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects HTTP 200 containing a provider error", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockResolvedValueOnce(reply({ error: "Not connected" }));
    await expect(send()).rejects.toMatchObject({
      status: 502,
      body: { status: "failed", trackingId: "tracking-1" },
    });
  });
  it("keeps missing-ID responses uncertain rather than successful", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockResolvedValueOnce(reply({ success: true }));
    await expect(send()).rejects.toMatchObject({
      body: { status: "unknown", trackingId: "tracking-1" },
    });
  });
  it("keeps timeouts uncertain and does not retry the POST", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockRejectedValueOnce(
        Object.assign(new Error("timeout"), { name: "AbortError" })
      );
    await expect(send()).rejects.toMatchObject({
      status: 504,
      body: { code: "send_outcome_unknown", trackingId: "tracking-1" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("reports failure if the delivery callback arrived before the POST response", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockResolvedValueOnce(reply({ messageId: "message-1" }));
    tracking.finish.mockResolvedValueOnce({ status: "failed" });
    await expect(send()).rejects.toMatchObject({
      body: { code: "send_failed", status: "failed" },
    });
  });
  it("returns tracking ID and uncertainty if persistence fails after acceptance", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ connected: true }))
      .mockResolvedValueOnce(reply({ messageId: "message-1" }));
    tracking.finish.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(send()).rejects.toMatchObject({
      status: 503,
      body: { code: "tracking_update_failed", trackingId: "tracking-1" },
    });
  });
  it("also checks connection for video and status publication", async () => {
    for (const path of [
      "send-video",
      "send-text-status",
      "send-button-actions",
    ]) {
      fetchMock.mockResolvedValueOnce(reply({ connected: false }));
      await expect(
        zapiRequest("POST", `${zapiInstancePath}/${path}`, {})
      ).rejects.toMatchObject({ status: 503 });
    }
    expect(tracking.begin).not.toHaveBeenCalled();
  });
  it("leaves read-only provider calls unchanged", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: [] }));
    await expect(
      zapiRequest("GET", `${zapiInstancePath}/contacts`)
    ).resolves.toEqual({ data: [] });
    expect(tracking.begin).not.toHaveBeenCalled();
  });
});
