const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
function session(saved) {
  const context = {
    chrome: {
      storage: {
        local: {
          async get() {
            return structuredClone(saved);
          },
          async set(value) {
            Object.assign(saved, structuredClone(value));
          },
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    readFileSync(`${__dirname}/status-cache.js`, "utf8").replace(
      /export /g,
      ""
    ),
    context
  );
  return context;
}
const order = {
  commandNumber: 1,
  customerPhone: "(46) 99105-2049",
  exists: true,
};
test("cache survives a new background session and separates date, number, phone and server", async () => {
  const saved = {};
  const first = session(saved);
  await first.writeStatusCache("server-a", "2026-10-18", [order]);
  const next = session(saved);
  assert.equal(
    (
      await next.readStatusCache("server-a", "2026-10-18", [
        { ...order, customerPhone: "+55 46 99105-2049" },
      ])
    )[0].exists,
    true
  );
  for (const [server, date, input] of [
    ["server-b", "2026-10-18", order],
    ["server-a", "2026-10-19", order],
    ["server-a", "2026-10-18", { ...order, commandNumber: 2 }],
    ["server-a", "2026-10-18", { ...order, customerPhone: "46999990000" }],
  ]) {
    assert.equal((await next.readStatusCache(server, date, [input]))[0], null);
  }
});
test("older automatic responses cannot overwrite a newer manual success in persistent cache", async () => {
  const cache = session({});
  await cache.writeStatusCache("server", "2026-10-18", [order]);
  await cache.writeStatusCache(
    "server",
    "2026-10-18",
    [{ ...order, exists: false }],
    0
  );
  assert.equal(
    (await cache.readStatusCache("server", "2026-10-18", [order]))[0].exists,
    true
  );
  await cache.writeStatusCache("server", "2026-10-18", [
    { ...order, exists: false },
  ]);
  assert.equal(
    (await cache.readStatusCache("server", "2026-10-18", [order]))[0].exists,
    false
  );
});
