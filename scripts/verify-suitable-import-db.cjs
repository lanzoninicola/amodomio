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
    ]) {
      const model = Prisma.dmmf.datamodel.models.find(
        (model) => model.name === name
      );
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
          if (field.isList) type += "[]";
          let fallback = "";
          if (field.name === "createdAt" || field.name === "updatedAt")
            fallback = " DEFAULT CURRENT_TIMESTAMP";
          else if (typeof field.default === "boolean")
            fallback = ` DEFAULT ${field.default ? "TRUE" : "FALSE"}`;
          else if (typeof field.default === "number")
            fallback = ` DEFAULT ${field.default}`;
          else if (typeof field.default === "string")
            fallback = ` DEFAULT '${field.default.replace(/'/g, "''")}'`;
          else if (field.isList) fallback = " DEFAULT '{}'";
          return `"${field.dbName || field.name}" ${type}${
            field.isRequired ? " NOT NULL" : ""
          }${fallback}${field.isId ? " PRIMARY KEY" : ""}`;
        });
      await pool.query(
        `CREATE TABLE "${model.dbName || model.name}" (${columns.join(",")})`
      );
    }
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    global.testPrisma = client;
    symlinkSync(join(root, "node_modules"), join(temp, "node_modules"), "dir");
    await build({
      entryPoints: [join(root, "app/domain/kds/import-order.server.ts")],
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
    const { createImportedOrder } = require(join(temp, "import.cjs"));
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
    const rejected = await createImportedOrder({ ...body, commandNumber: 2 });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error, "insufficient_dough_stock");
    header = await client.kdsDailyOrder.findUnique({ where: { id: "header" } });
    assert.equal(header.operationStatus, "CLOSED");
    await pool.query(
      'UPDATE dough_daily_stock SET size=\'{"base":{"F":999},"adjustment":{"F":2},"adjustmentMode":"override"}\''
    );
    const stockRace = await Promise.all([
      createImportedOrder({ ...body, commandNumber: 2 }),
      createImportedOrder({ ...body, commandNumber: 3 }),
    ]);
    assert.deepEqual(stockRace.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await client.kdsDailyOrderDetail.count(), 2);
    header = await client.kdsDailyOrder.findUnique({ where: { id: "header" } });
    assert.equal(Number(header.totOrdersAmount), 100);
    assert.equal(header.operationStatus, "REOPENED");
    // Force a post-create failure to prove the write and reopening roll back together.
    await pool.query("UPDATE kds_daily_orders SET operation_status='CLOSED'");
    await pool.query("UPDATE dough_daily_stock SET size='{\"F\":3}'");
    await pool.query(
      "ALTER TABLE kds_daily_orders ADD CONSTRAINT fixture_total_limit CHECK (tot_orders_amount <= 100)"
    );
    await assert.rejects(createImportedOrder({ ...body, commandNumber: 4 }));
    assert.equal(await client.kdsDailyOrderDetail.count(), 2);
    header = await client.kdsDailyOrder.findUnique({ where: { id: "header" } });
    assert.equal(header.operationStatus, "CLOSED");
    assert.equal(Number(header.totOrdersAmount), 100);
    process.stdout.write(
      "PASS isolated PostgreSQL: reserved command, duplicate race, stock race, automatic reopening, transactional total and rollback\n"
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
