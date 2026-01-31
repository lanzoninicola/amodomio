import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const env = process.env.NODE_ENV || "production";
const prismaDatasourceUrl = process.env?.PRISMA_DB_URL;
const prismaDevDatasourceUrl = process.env?.PRISMA_DB_DEV_URL;

const datasourceUrl =
  env === "development" ? prismaDevDatasourceUrl : prismaDatasourceUrl;
const pool = datasourceUrl ? new Pool({ connectionString: datasourceUrl }) : undefined;
const adapter = pool ? new PrismaPg(pool) : undefined;

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

const prismaClient = new AMMPrismaClient({ adapter });

export default prismaClient;
