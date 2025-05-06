import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

class DnaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }
}

export const dnaEntity = new DnaEntity({
  client: prismaClient,
});
