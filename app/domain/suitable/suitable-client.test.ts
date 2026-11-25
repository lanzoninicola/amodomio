import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

async function client() {
  vi.stubEnv("SUITABLE_CLIENT_ID", "private-client");
  vi.stubEnv("SUITABLE_CLIENT_SECRET", "private-secret");
  return import("./suitable-client.server");
}

it("explains auth failures without leaking provider secrets", async () => {
  const { getSuitableToken } = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "invalid_client", detail: "private-secret" }), { status: 401 })));
  await expect(getSuitableToken()).rejects.toThrow(/invalid_client.*POST \/api\/auth\/token\/.*401/);
  await expect(getSuitableToken()).rejects.not.toThrow("private-secret");
});

it("identifies missing configuration by exact variable name", async () => {
  const { getSuitableToken } = await client();
  vi.stubEnv("SUITABLE_CLIENT_SECRET", "");
  await expect(getSuitableToken()).rejects.toThrow(/missing_configuration.*SUITABLE_CLIENT_SECRET/);
});

it("rejects malformed token responses before caching", async () => {
  const { getSuitableToken } = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}')));
  await expect(getSuitableToken()).rejects.toThrow("invalid_token_response");
});

it("reports request endpoint, scope and guidance for forbidden calls", async () => {
  const { listSuitableWebhooks } = await client();
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 })))
    .mockResolvedValueOnce(new Response('<html>denied</html>', { status: 403 })));
  await expect(listSuitableWebhooks()).rejects.toThrow(/GET \/api\/webhooks\/.*webhook:manage.*403.*escopo/);
});

it("classifies timeout separately from HTTP failures", async () => {
  const { getSuitableToken } = await client();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
  await expect(getSuitableToken()).rejects.toMatchObject({ status: 0, code: "timeout" });
});

it("rejects invalid successful JSON instead of returning null", async () => {
  const { getSuitableToken } = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<html>proxy</html>')));
  await expect(getSuitableToken()).rejects.toThrow("invalid_json");
});

it("includes a truncated provider body with credentials redacted", async () => {
  const { getSuitableToken } = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: "invalid_client", detail: "client private-client secret private-secret", access_token: "sensitive-token", extra: "x".repeat(2000),
  }), { status: 400 })));
  const error = await getSuitableToken().catch(e => e);
  expect(error.message).toContain("etapa=auth");
  expect(error.message).toContain("corpo=");
  expect(error.message).toContain("[REDACTED]");
  expect(error.message).not.toContain("private-secret");
  expect(error.message).not.toContain("private-client");
  expect(error.message).not.toContain("sensitive-token");
  expect(error.message.length).toBeLessThan(1100);
});

it("shares a supplied deadline across auth and order fetch", async () => {
  const { fetchSuitableOrder } = await client();
  const signal = AbortSignal.timeout(3000);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1902, display_number: "1" })));
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchSuitableOrder(1902, { signal })).resolves.toMatchObject({ display_number: "1" });
  expect(fetchMock.mock.calls.every(args => args[1].signal === signal)).toBe(true);
});
