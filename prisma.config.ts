import "dotenv/config";
import { readFileSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

const runtimeEnv = process.env.NODE_ENV ?? "production";
const datasourceUrl =
  runtimeEnv === "development" ? env("PRISMA_DB_DEV_URL") : env("PRISMA_DB_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: {
    externalTables: true,
  },
  datasource: {
    url: datasourceUrl,
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    initShadowDb: readFileSync(
      new URL("./prisma/shadow-init.sql", import.meta.url),
      "utf8"
    ),
  },
});
