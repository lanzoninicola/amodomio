import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  request: vi.fn(),
  delay: vi.fn(),
}));
vi.mock("node:timers/promises", () => ({ setTimeout: mocks.delay }));
vi.mock("./zapi-client.server", async (original) => {
  const actual = await original<typeof import("./zapi-client.server")>();
  return {
    ...actual,
    getZapiConnection: mocks.connection,
    zapiRequest: mocks.request,
    zapiInstancePath: "/instances/instance/token/private",
  };
});
vi.mock("@config/env", () => ({ env: {} }));
vi.mock("./message-tracking.server", () => ({
  beginTrackedMessage: vi.fn(),
  finishTrackedMessage: vi.fn(),
}));
import {
  checkZapiReconnection,
  getZapiPairingQrCode,
  tryReconnectZapi,
} from "./reconnection.server";
// PNG signature, sufficient to validate the provider transport format.
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.delay.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue({ connected: false });
});

describe("Z-API reconnection", () => {
  it("does not restart an already connected instance", async () => {
    mocks.connection.mockResolvedValue({ connected: true });
    expect((await tryReconnectZapi()).state).toBe("connected");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("restarts once and confirms recovery before claiming success", async () => {
    mocks.connection
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValueOnce({ connected: true });
    mocks.request.mockResolvedValue({ value: true });
    expect((await tryReconnectZapi()).state).toBe("connected");
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0][1]).toMatch(/\/restart$/);
  });
  it("offers a QR code after bounded checks, with no second restart", async () => {
    mocks.request
      .mockResolvedValueOnce({ value: true })
      .mockResolvedValueOnce({ value: `data:image/png;base64,${png}` });
    const result = await tryReconnectZapi();
    expect(result).toMatchObject({
      state: "qr",
      qrCode: `data:image/png;base64,${png}`,
    });
    expect(result.state === "qr" && result.expiresAt).toBeGreaterThan(
      Date.now()
    );
    expect(mocks.delay).toHaveBeenCalledTimes(4);
    expect(
      mocks.request.mock.calls.filter((call) => call[1].endsWith("/restart"))
    ).toHaveLength(1);
  });
  it("requires an explicit restart acknowledgment", async () => {
    mocks.request.mockResolvedValue({ value: false });
    await expect(tryReconnectZapi()).rejects.toMatchObject({ status: 502 });
    expect(mocks.delay).not.toHaveBeenCalled();
  });
  it("does not interpret status-query failures as disconnected or silently retry restart", async () => {
    mocks.connection
      .mockResolvedValueOnce({ connected: false })
      .mockRejectedValue(new Error("offline"));
    mocks.request.mockResolvedValue({ value: true });
    await expect(tryReconnectZapi()).rejects.toMatchObject({ status: 504 });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("checks again before generating QR, allowing sessions that recovered late", async () => {
    mocks.connection.mockResolvedValue({ connected: true });
    expect((await getZapiPairingQrCode()).state).toBe("connected");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("supports raw base64 QR responses", async () => {
    mocks.request.mockResolvedValue(png);
    expect(await getZapiPairingQrCode()).toMatchObject({
      state: "qr",
      qrCode: `data:image/png;base64,${png}`,
    });
  });
  it.each([
    { value: "https://untrusted.test/qr" },
    { value: "data:image/svg+xml;base64,PHN2Zz4=" },
    { error: "not available" },
  ])("rejects unsupported QR payloads: %j", async (body) => {
    mocks.request.mockResolvedValue(body);
    await expect(getZapiPairingQrCode()).rejects.toMatchObject({ status: 502 });
  });
  it("explains when WhatsApp requires additional authentication", async () => {
    mocks.request.mockResolvedValue({ challenge: { secret: "do-not-expose" } });
    await expect(getZapiPairingQrCode()).rejects.toMatchObject({
      status: 409,
      body: null,
    });
  });
  it("reports disconnected when there is no positive connection evidence", async () => {
    expect((await checkZapiReconnection()).state).toBe("disconnected");
  });
});
