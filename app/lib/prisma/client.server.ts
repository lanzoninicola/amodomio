import { PrismaClient } from "@prisma/client";

const env = process.env.NODE_ENV || "production";
const prismaDatasourceUrl = process.env?.PRISMA_DB_URL;
const prismaDevDatasourceUrl = process.env?.PRISMA_DB_DEV_URL;

const datasourceUrl =
  env === "development" ? prismaDevDatasourceUrl : prismaDatasourceUrl;

const prismaClient = new PrismaClient({ datasourceUrl });

export default prismaClient;
