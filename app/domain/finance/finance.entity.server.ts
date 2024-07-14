import { PrismaEntityProps } from "~/lib/prisma/types.server";

class FinanceEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  // loadOrders() {
  //   return this.client.order.findMany();
  // }
}
