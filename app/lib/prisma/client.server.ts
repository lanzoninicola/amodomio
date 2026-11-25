import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const env = process.env.NODE_ENV || "production";
const prismaDatasourceUrl = process.env?.PRISMA_DB_URL;
const prismaDevDatasourceUrl = process.env?.PRISMA_DB_DEV_URL;

const datasourceUrl =
  env === "development"
    ? prismaDevDatasourceUrl ?? prismaDatasourceUrl
    : prismaDatasourceUrl;

class AMMPrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions
> extends PrismaClient {
  datasourceUrl: string | undefined;

  dbName: string | undefined;

  constructor(optionsArg?: Prisma.Subset<T, Prisma.PrismaClientOptions>) {
    super(optionsArg);

    this.datasourceUrl = datasourceUrl;

    if (datasourceUrl) {
      const match = datasourceUrl.match(/\/([^\/?]+)(?:\?|$)/);

      if (match) {
        this.dbName = match[1];
      }
    }
  }
}

const globalForPrisma = globalThis as typeof globalThis & {
  ammPrismaClient?: AMMPrismaClient;
};

function createPrismaClient() {
  const pool = datasourceUrl
    ? new Pool({
        connectionString: datasourceUrl,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      })
    : undefined;
  const adapter = pool
    ? new PrismaPg(pool, { disposeExternalPool: true })
    : undefined;

  return new AMMPrismaClient({ adapter });
}

// Vite re-evaluates server modules during HMR; keep the client and its pool alive.
const prismaClient = globalForPrisma.ammPrismaClient ?? createPrismaClient();

if (env !== "production") globalForPrisma.ammPrismaClient = prismaClient;

export default prismaClient;
