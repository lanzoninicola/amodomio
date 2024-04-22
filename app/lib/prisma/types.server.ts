import { Prisma, PrismaClient } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";

export interface PrismaEntityProps {
  client: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>;
}
