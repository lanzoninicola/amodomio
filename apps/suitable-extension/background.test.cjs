const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
function setup(fetch, modules) {
  let listener;
  let saved = {};
  vm.runInNewContext(
    readFileSync(`${__dirname}/status-cache.js`, "utf8").replace(
      /export /g,
      ""
    ) +
      "\n" +
      readFileSync(`${__dirname}/parser.js`, "utf8") +
      "\n" +
      readFileSync(`${__dirname}/background.js`, "utf8").replace(
        /^import .*;$/gm,
        ""
      ),
    {
      chrome: {
        storage: {
          local: {
            setAccessLevel() {},
            async set(value) {
              Object.assign(saved, value);
            },
            async get() {
              return {
                ...saved,
                serverUrl: "https://kds.test",
                apiKey: "test-key",
                suitableOrigin: "https://suitable.test",
                modules,
              };
            },
          },
        },
        runtime: {
          onMessage: {
            addListener(fn) {
              listener = fn;
            },
          },
        },
      },
      URL,
      Set,
      AbortSignal,
      fetch,
    }
  );
  return (order, origin = "https://suitable.test", type = "suitable:create") =>
    new Promise((resolve) =>
      listener(
        type === "suitable:statuses"
          ? { type, ...order }
          : type === "suitable:create-zone"
          ? { type, zone: order }
          : type === "suitable:stock"
          ? { type, payload: order }
          : { type, order },
        { tab: { id: 1 }, url: `${origin}/pedido` },
        resolve
      )
    );
}
const order = {
  commandNumber: 1,
  date: "2026-10-11",
  customerName: "Nicola Lanzoni",
  customerPhone: "(46) 99105-2049",
  orderAmount: 59.9,
  takeAway: true,
  orderItems: [
    {
      name: "Pizzas INDIVIDUAL",
      quantity: 1,
      size: "I",
      flavors: ["1x A more mio"],
      notes: [],
    },
  ],
};
test("opens the order date through the authenticated REST endpoint", async () => {
  const send = setup(async (url, options) => {
    assert.equal(url, "https://kds.test/api/kds/day/open");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-api-key"], "test-key");
    assert.deepEqual(JSON.parse(options.body), { date: order.date });
    return {
      ok: true,
      async json() {
        return { ok: true, status: "OPENED" };
      },
    };
  });
  assert.equal(
    (await send(order, "https://suitable.test", "suitable:open-day")).dayStatus,
    "OPENED"
  );
});
test("opening a day from an unauthorized origin never calls the server", async () => {
  const send = setup(() => assert.fail("Must not send"));
  assert.equal(
    (await send(order, "https://other.test", "suitable:open-day")).ok,
    false
  );
});
test("an opening refusal keeps the error instead of reporting success", async () => {
  const send = setup(async () => ({
    ok: false,
    status: 500,
    async json() {
      return { ok: false, error: "Falha ao abrir dia" };
    },
  }));
  const result = await send(
    order,
    "https://suitable.test",
    "suitable:open-day"
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "Falha ao abrir dia");
});
test("sends the modal items and leaves status calculation to the KDS", async () => {
  const send = setup(async (url, options) => {
    assert.equal(url, "https://kds.test/api/kds/orders");
    assert.equal(options.headers["x-api-key"], "test-key");
    const body = JSON.parse(options.body);
    assert.equal(body.customerPhone, "46991052049");
    assert.equal(body.customerName, order.customerName);
    assert.equal(body.status, undefined);
    assert.deepEqual(body.orderItems, order.orderItems);
    assert.equal(body.channel, "CARDAPIO");
    assert.equal(body.sizes, undefined);
    assert.equal(body.orderAmount, 59.9);
    assert.equal(body.takeAway, true);
    return {
      ok: true,
      async json() {
        return { ok: true, id: "created", status: "novoPedido" };
      },
    };
  });
  assert.equal((await send(order)).id, "created");
});
test("rejects messages from a different website without calling the API", async () => {
  const send = setup(() => assert.fail("Must not send"));
  assert.equal((await send(order, "https://other.test")).ok, false);
});
test("sends the selected order channel to the server", async () => {
  const send = setup(async (_url, options) => {
    assert.equal(JSON.parse(options.body).channel, "CARDAPIO");
    return {
      ok: true,
      async json() {
        return { ok: true, id: "created" };
      },
    };
  });
  assert.equal((await send({ ...order, channel: "CARDAPIO" })).ok, true);
});
test("invalid order channels prevent a POST", async () => {
  const send = setup(() => assert.fail("Must not send"));
  for (const channel of ["", "  ", 123, "a".repeat(101)]) {
    assert.equal((await send({ ...order, channel })).ok, false);
  }
});
test("reports duplicate numbers without treating an existing order as imported", async () => {
  const send = setup(async () => ({
    ok: false,
    status: 400,
    async json() {
      return { error: "duplicate_command_number" };
    },
  }));
  const result = await send(order);
  assert.equal(result.ok, false);
  assert.match(result.error, /Já existe/);
});
test("rejects invalid order numbers and negative amounts before sending", async () => {
  const send = setup(() => assert.fail("Must not send"));
  assert.equal((await send({ ...order, commandNumber: 1.5 })).ok, false);
  assert.equal((await send({ ...order, orderAmount: -1 })).ok, false);
});

test("delivery sends the existing KDS zone ID and fee, without adding fee to total", async () => {
  const send = setup(async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.orderAmount, 479.6);
    assert.equal(body.motoValue, 10);
    assert.equal(body.hasMoto, true);
    assert.equal(body.takeAway, false);
    assert.equal(body.deliveryZoneId, "morro-id");
    return { ok: true, json: async () => ({ ok: true, id: "created" }) };
  });
  assert.equal(
    (
      await send({
        ...order,
        takeAway: false,
        orderAmount: 479.6,
        deliveryFee: 10,
        deliveryZoneId: "morro-id",
      })
    ).ok,
    true
  );
});
test("missing delivery fee or zone prevents POST", async () => {
  const send = setup(() => {
    throw new Error("must not fetch");
  });
  assert.equal(
    (await send({ ...order, takeAway: false, deliveryFee: 10 })).ok,
    false
  );
  assert.equal(
    (await send({ ...order, takeAway: false, deliveryZoneId: "morro-id" })).ok,
    false
  );
});
test("delivery zones are fetched with the server key and limited to the configured Suitable origin", async () => {
  const send = setup(async (url, options) => {
    assert.equal(url, "https://kds.test/api/kds/delivery-zones");
    assert.equal(options.headers["x-api-key"], "test-key");
    return {
      ok: true,
      json: async () => ({
        ok: true,
        zones: [{ id: "morro-id", name: "Morro da Cruz" }],
      }),
    };
  });
  assert.equal(
    (await send(null, "https://suitable.test", "suitable:zones")).zones[0].id,
    "morro-id"
  );
  assert.equal(
    (await send(null, "https://other.test", "suitable:zones")).ok,
    false
  );
});

test("server stock and operation refusals are shown with actionable messages", async () => {
  const send = setup(async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      ok: false,
      error: "insufficient_dough_stock",
      message: "F: solicitadas 2, disponíveis 1",
    }),
  }));
  assert.match((await send(order)).error, /F: solicitadas 2, disponíveis 1/);
  const sendPending = setup(async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: "day_not_open" }),
  }));
  assert.match((await sendPending(order)).error, /Abra o dia/);
});

test("checks the server without creating an order or forwarding customer details", async () => {
  const send = setup(async (url, options) => {
    assert.equal(url, "https://kds.test/api/kds/orders/check");
    assert.equal(options.method, "POST");
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), [
      "commandNumber",
      "date",
      "orderItems",
    ]);
    return {
      ok: true,
      async json() {
        return { ok: true, check: { exists: true, canSend: false } };
      },
    };
  });
  const result = await send(order, "https://suitable.test", "suitable:check");
  assert.equal(result.check.exists, true);
});

test("disabled KDS rejects requests without calling the server", async () => {
  let calls = 0;
  const send = setup(
    async () => {
      calls++;
    },
    { kds: { enabled: false } }
  );
  const result = await send(order);
  assert.equal(result.ok, false);
  assert.match(result.error, /desativada/);
  assert.equal(calls, 0);
});

test("missing check route explains the required server update", async () => {
  const send = setup(async () => ({ ok: false, status: 404 }));
  const result = await send(order, "https://suitable.test", "suitable:check");
  assert.equal(result.ok, false);
  assert.match(result.error, /Atualize o servidor/);
  assert.match(result.error, /api\/kds\/orders\/check/);
});

test("stock uses global connection independently of disabled KDS", async () => {
  let called;
  const send = setup(
    async (url, options) => {
      called = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          batchId: "batch",
          path: "/admin/import-stock-movements/batch",
        }),
      };
    },
    { kds: { enabled: false } }
  );
  const payload = { action: "create", note: { invoiceNumber: "000002377" } };
  const result = await send(payload, "https://suitable.test", "suitable:stock");
  assert.equal(result.ok, true);
  assert.equal(called.url, "https://kds.test/api/stock/suitable");
  assert.deepEqual(JSON.parse(called.options.body), payload);
  assert.equal(called.options.headers["x-api-key"], "test-key");
  assert.equal(
    result.url,
    "https://kds.test/admin/import-stock-movements/batch"
  );
});
test("stock rejects an unauthorized page before any request", async () => {
  let called = false;
  const send = setup(async () => {
    called = true;
  });
  const result = await send(
    { action: "start" },
    "https://other.test",
    "suitable:stock"
  );
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("successful form send populates local status cache and chip refresh bypasses it", async () => {
  let calls = 0;
  const send = setup(async (url) => {
    calls++;
    return {
      ok: true,
      status: 200,
      async json() {
        return url.endsWith("/status")
          ? {
              ok: true,
              date: order.date,
              statuses: [
                {
                  commandNumber: 1,
                  customerPhone: "46991052049",
                  exists: false,
                },
              ],
            }
          : { ok: true, id: "sent", status: "novoPedido" };
      },
    };
  });
  assert.equal((await send(order)).ok, true);
  const query = {
    date: order.date,
    orders: [{ commandNumber: 1, customerPhone: "+55 (46) 99105-2049" }],
  };
  const cached = await send(
    query,
    "https://suitable.test",
    "suitable:statuses"
  );
  assert.equal(cached.statuses[0].exists, true);
  assert.equal(calls, 1, "reading chip after form send must not fetch again");
  const refreshed = await send(
    { ...query, force: true },
    "https://suitable.test",
    "suitable:statuses"
  );
  assert.equal(refreshed.statuses[0].exists, false);
  assert.equal(calls, 2, "clicking chip must bypass persistent cache");
  const after = await send(query, "https://suitable.test", "suitable:statuses");
  assert.equal(after.statuses[0].exists, false);
  assert.equal(calls, 2, "refresh result must replace local cache");
});

test("explicit zone creation posts to the authenticated server and rejects other origins", async () => {
  let calls = 0;
  const zone = { name: "Cidade Industrial", city: "Pato Branco", state: "PR" };
  const send = setup(async (url, options) => {
    calls++;
    assert.equal(url, "https://kds.test/api/kds/delivery-zones");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-api-key"], "test-key");
    assert.deepEqual(JSON.parse(options.body), zone);
    return {
      ok: true,
      status: 201,
      json: async () => ({ ok: true, zone: { ...zone, id: "new-zone" } }),
    };
  });
  assert.equal(
    (await send(zone, "https://suitable.test", "suitable:create-zone")).zone.id,
    "new-zone"
  );
  assert.equal(
    (await send(zone, "https://other.test", "suitable:create-zone")).ok,
    false
  );
  assert.equal(calls, 1);
});

test("zone creation explains when the deployed server does not support it", async () => {
  const send = setup(async () => ({ status: 405 }));
  const result = await send(
    {},
    "https://suitable.test",
    "suitable:create-zone"
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Atualize o servidor/);
});
