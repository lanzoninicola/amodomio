const { mkdtempSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { build } = require("esbuild");
require("dotenv").config({ quiet: true });
// Require an explicit database environment; never fall through to production.
const development = process.argv.includes("--development");
if (!development && !process.argv.includes("--production")) {
  process.stderr.write(
    "Informe --development ou --production. Sem --apply, apenas mostra as quantidades.\n"
  );
  process.exit(1);
}
process.env.NODE_ENV = development ? "development" : "production";
const root = process.cwd();
// Keep beside node_modules so external dependencies resolve correctly.
const temp = mkdtempSync(join(root, ".crm-backfill-"));
(async () => {
  try {
    await build({
      entryPoints: [join(root, "app/domain/crm/order-history.server.ts")],
      outfile: join(temp, "history.cjs"),
      bundle: true,
      alias: { "~": join(root, "app") },
      platform: "node",
      format: "cjs",
      packages: "external",
    });
    const { backfillPurchaseHistory } = require(join(temp, "history.cjs"));
    process.stdout.write(
      JSON.stringify(
        await backfillPurchaseHistory(process.argv.includes("--apply")),
        null,
        2
      ) + "\n"
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
})()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exit(1);
  });
