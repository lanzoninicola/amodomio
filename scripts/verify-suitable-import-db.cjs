const {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const assert = require("node:assert/strict");
const root = process.cwd();
const requireProject = createRequire(join(root, "package.json"));
const { Prisma, PrismaClient } = requireProject("@prisma/client");
const { PrismaPg } = requireProject("@prisma/adapter-pg");
const { Pool } = requireProject("pg");
const { build } = requireProject("esbuild");
const temp = mkdtempSync(join(tmpdir(), "suitable-import-db-"));
const bin = process.env.POSTGRES_BIN || "/usr/lib/postgresql/18/bin";
let running = false,
  client,
  pool;
(async () => {
  try {
    execFileSync(
      join(bin, "initdb"),
      ["-D", join(temp, "data"), "-A", "trust", "-U", "testuser"],
      { stdio: "ignore" }
    );
    execFileSync(
      join(bin, "pg_ctl"),
      [
        "-D",
        join(temp, "data"),
        "-l",
        join(temp, "log"),
        "-o",
        `-k ${temp} -h '' -p 55439`,
        "-w",
        "start",
      ],
      { stdio: "ignore" }
    );
    running = true;
    pool = new Pool({
      host: temp,
      port: 55439,
      user: "testuser",
      database: "postgres",
    });
    for (const name of [
      "KdsDailyOrder",
      "KdsDailyOrderDetail",
      "DoughDailyStock",
      "DeliveryZone",
      "CrmCustomer",
      "CustomerOrder",
      "CustomerOrderItem",
    ]) {
      const model = Prisma.dmmf.datamodel.models.find(
        (model) => model.name === name
      );
      const modelSchema = readFileSync(
        join(root, "prisma/schema.prisma"),
        "utf8"
      )
        .split(`model ${name} {`)[1]
        .split("\n}")[0];
      const scalar = {
        String: "TEXT",
        Int: "INTEGER",
        DateTime: "TIMESTAMP(3)",
        Decimal: "NUMERIC(10,2)",
        Boolean: "BOOLEAN",
        Json: "JSONB",
      };
      const columns = model.fields
        .filter((field) => field.kind !== "object")
        .map((field) => {
          let type = scalar[field.type];
          if (!type) throw new Error("Unsupported fixture type");
          const definition = modelSchema.match(
            new RegExp(`^\\s+${field.name}\\s+\\w+(\\[\\]|\\?)?(.*)$`, "m")
          );
          const isList = definition?.[1] === "[]";
          const required = definition?.[1] !== "?";
          const annotations = definition?.[2] || "";
          if (isList) type += "[]";
          let fallback = "";
          if (
            ["createdAt", "updatedAt", "created_at", "updated_at"].includes(
              field.name
            )
          )
            fallback = " DEFAULT CURRENT_TIMESTAMP";
          else if (typeof field.default === "boolean")
            fallback = ` DEFAULT ${field.default ? "TRUE" : "FALSE"}`;
          else if (typeof field.default === "number")
            fallback = ` DEFAULT ${field.default}`;
          else if (typeof field.default === "string")
            fallback = ` DEFAULT '${field.default.replace(/'/g, "''")}'`;
          else if (isList) fallback = " DEFAULT '{}'";
          else if (annotations.includes("@default(true)"))
            fallback = " DEFAULT TRUE";
          else if (annotations.includes("@default(false)"))
            fallback = " DEFAULT FALSE";
          else if (annotations.match(/@default\((-?\d+)\)/))
            fallback = ` DEFAULT ${
              annotations.match(/@default\((-?\d+)\)/)[1]
            }`;
          else if (annotations.match(/@default\("([^"]*)"\)/))
            fallback = ` DEFAULT '${annotations
              .match(/@default\("([^"]*)"\)/)[1]
              .replace(/'/g, "''")}'`;
          return `"${field.dbName || field.name}" ${type}${
            required ? " NOT NULL" : ""
          }${fallback}${annotations.includes("@id") ? " PRIMARY KEY" : ""}`;
        });
      await pool.query(
        `CREATE TABLE "${model.dbName || model.name}" (${columns.join(",")})`
      );
    }
    await pool.query(
      "CREATE UNIQUE INDEX fixture_kds_id ON kds_daily_order_details(id); CREATE UNIQUE INDEX fixture_history_id ON customer_orders(id); CREATE UNIQUE INDEX fixture_crm_id ON crm_customer(id); CREATE UNIQUE INDEX fixture_crm_phone ON crm_customer(phone_e164); CREATE UNIQUE INDEX fixture_kds_history ON customer_orders(kds_order_id); ALTER TABLE customer_orders ADD FOREIGN KEY(kds_order_id) REFERENCES kds_daily_order_details(id) ON DELETE SET NULL"
    );
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    global.testPrisma = client;
    symlinkSync(join(root, "node_modules"), join(temp, "node_modules"), "dir");
    await build({
      stdin: {
        contents:
          'export { createImportedOrder } from "./app/domain/kds/import-order.server"; export { getCustomerPurchaseHistory } from "./app/domain/crm/order-history.server";',
        resolveDir: root,
        loader: "ts",
      },
      outfile: join(temp, "import.cjs"),
      bundle: true,
      alias: { "~": join(root, "app") },
      platform: "node",
      format: "cjs",
      packages: "external",
      plugins: [
        {
          name: "isolated-test",
          setup(builder) {
            builder.onLoad({ filter: /client\.server\.ts$/ }, () => ({
              contents: "export default globalThis.testPrisma;",
              loader: "ts",
            }));
            // Use the actual stock reader/parser; exclude unrelated notification imports.
            builder.onLoad(
              { filter: /dough-stock\.server\.ts$/ },
              ({ path }) => ({
                contents: readFileSync(path, "utf8")
                  .split("export async function getPreviousDoughStock")[0]
                  .replace(/^import .*crm-whatsapp-events.*;\n/gm, "")
                  .replace(/^import .*zapi\.service.*;\n/gm, ""),
                loader: "ts",
              })
            );
          },
        },
      ],
    });
    const { createImportedOrder, getCustomerPurchaseHistory } = require(join(
      temp,
      "import.cjs"
    ));
    await pool.query(
      "INSERT INTO kds_daily_orders(id,date,date_int,operation_status,closed_at) VALUES('header','2026-10-11',20261011,'CLOSED',NOW())"
    );
    await pool.query(
      "INSERT INTO kds_daily_order_details(id,order_id,date_int,command_number,status,sort_order_index,size) VALUES('reserved','header',20261011,1,'pendente',1000,'{\"F\":0}')"
    );
    await pool.query(
      "INSERT INTO dough_daily_stock(id,date,date_int,size) VALUES('stock','2026-10-11',20261011,'{\"F\":1}')"
    );
    const body = {
      date: "2026-10-11",
      commandNumber: 1,
      takeAway: true,
      orderAmount: 50,
      customerName: "Cliente teste",
      customerPhone: "46991052049",
      channel: "Suitable",
      orderItems: [
        {
          name: "Pizzas FAMÍLIA",
          quantity: 1,
          size: "F",
          flavors: ["1x Boscaiola", "1x Calabresa"],
          notes: [],
        },
      ],
    };
    await client.kdsDailyOrderDetail.findMany();
    const same = await Promise.all([
      createImportedOrder(body),
      createImportedOrder(body),
    ]);
    if (same.every((r) => r.status !== 200))
      process.stdout.write(
        JSON.stringify(await Promise.all(same.map((r) => r.clone().json()))) +
          "\n"
      );
    assert.deepEqual(same.map((r) => r.status).sort(), [200, 409]);
    const row = await client.kdsDailyOrderDetail.findUnique({
      where: { id: "reserved" },
    });
    assert.equal(row.status, "novoPedido");
    assert.equal(row.orderItems[0].flavors.length, 2);
    let header = await client.kdsDailyOrder.findUnique({
      where: { id: "header" },
    });
    assert.equal(header.operationStatus, "REOPENED");
    assert.equal(Number(header.totOrdersAmount), 50);
    assert.ok(header.closedAt);
    await pool.query("UPDATE kds_daily_orders SET operation_status='CLOSED'");
    await pool.query(
      'UPDATE dough_daily_stock SET size=\'{"base":{"F":999},"adjustment":{"F":2},"adjustmentMode":"override"}\''
    );
    const stockRace = await Promise.all([
      createImportedOrder({ ...body, commandNumber: 2 }),
      createImportedOrder({ ...body, commandNumber: 3 }),
    ]);
    assert.deepEqual(stockRace.map((r) => r.status).sort(), [200, 200]);
    assert.equal(await client.kdsDailyOrderDetail.count(), 3);
    header = await client.kdsDailyOrder.findUnique({ where: { id: "header" } });
    assert.equal(Number(header.totOrdersAmount), 150);
    assert.equal(header.operationStatus, "REOPENED");
    // Force a post-create failure to prove the write and reopening roll back together.
    await pool.query("UPDATE kds_daily_orders SET operation_status='CLOSED'");
    await pool.query("UPDATE dough_daily_stock SET size='{\"F\":3}'");
    await pool.query(
      "ALTER TABLE kds_daily_orders ADD CONSTRAINT fixture_total_limit CHECK (tot_orders_amount <= 150)"
    );
    await assert.rejects(createImportedOrder({ ...body, commandNumber: 4 }));
    assert.equal(await client.kdsDailyOrderDetail.count(), 3);
    header = await client.kdsDailyOrder.findUnique({ where: { id: "header" } });
    assert.equal(header.operationStatus, "CLOSED");
    assert.equal(Number(header.totOrdersAmount), 150);
    assert.equal(await client.crmCustomer.count(), 1);
    assert.equal(await client.customerOrder.count(), 3);
    const history = await client.customerOrder.findUnique({
      where: { kdsOrderId: "reserved" },
      include: { items: true },
    });
    assert.equal(history.items[0].flavors.length, 2);
    await pool.query(
      "ALTER TABLE kds_daily_orders DROP CONSTRAINT fixture_total_limit"
    );
    const corrected = await createImportedOrder({
      ...body,
      updateExisting: true,
      customerPhone: "46999999999",
      orderAmount: 60,
      orderItems: [{ ...body.orderItems[0], flavors: ["1x Margherita"] }],
    });
    assert.equal(corrected.status, 200);
    const updatedHistory = await client.customerOrder.findUnique({
      where: { kdsOrderId: "reserved" },
      include: { items: true },
    });
    assert.equal(updatedHistory.id, history.id);
    assert.equal(updatedHistory.phoneE164, "+5546999999999");
    assert.equal(Number(updatedHistory.totalAmount), 60);
    assert.equal(updatedHistory.items.length, 1);
    assert.deepEqual(updatedHistory.items[0].flavors, ["1x Margherita"]);
    assert.equal(await client.customerOrder.count(), 3);
    await client.kdsDailyOrderDetail.delete({ where: { id: "reserved" } });
    const canceled = await client.customerOrder.findUnique({
      where: { id: history.id },
    });
    assert.equal(canceled.kdsOrderId, null);
    const report = await getCustomerPurchaseHistory(
      updatedHistory.customerId,
      updatedHistory.phoneE164
    );
    assert.equal(report.orders.length, 1);
    assert.equal(report.summary.orders, 0);
    assert.deepEqual(report.summary.flavors, []);
    assert.equal(report.orders[0].active, false);
    process.stdout.write(
      "PASS isolated PostgreSQL: reserved command, duplicate race, advisory stock shortage, automatic reopening, transactional total, CRM identity, corrections, flavor snapshots, cancellation and rollback\n"
    );
  } finally {
    if (client) await client.$disconnect();
    if (pool) await pool.end();
    if (running)
      execFileSync(
        join(bin, "pg_ctl"),
        ["-D", join(temp, "data"), "-m", "immediate", "stop"],
        { stdio: "ignore" }
      );
    rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(error.stack + "\n");
  process.exitCode = 1;
});
