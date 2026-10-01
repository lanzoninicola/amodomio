const { test } = require("node:test");
const assert = require("node:assert/strict");
const { apiRequest } = require("./policy.cjs");
test("permite autenticação e pedidos no servidor LAN ou HTTPS", () => {
  for (const baseUrl of [
    "http://192.168.1.10:3000",
    "https://app.example.com/",
  ]) {
    for (const [path, methods] of Object.entries({
      "/api/kds/mobile-auth": ["GET", "POST", "DELETE"],
      "/api/kds/orders?date=2026-09-29": ["GET", "PATCH"],
    })) {
      for (const method of methods)
        assert.equal(apiRequest({ baseUrl, path, method }).method, method);
    }
  }
});
test("impede usar a ponte para acessar outros protocolos, servidores e rotas", () => {
  for (const input of [
    { baseUrl: "file:///etc/passwd" },
    { baseUrl: "https://user:pass@example.com" },
    { baseUrl: "https://example.com/admin" },
    { path: "https://evil.example/api/kds/orders" },
    { path: "//evil.example/api/kds/orders" },
    { path: "/api/kds/../admin" },
    { path: "/admin/users" },
    { method: "DELETE" },
    { body: "x".repeat(65537) },
    { token: { secret: true } },
  ])
    assert.throws(() =>
      apiRequest({
        baseUrl: "https://app.example.com",
        path: "/api/kds/orders",
        ...input,
      })
    );
});
