import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type SellingChannelKey = "cardapio" | "aiqfome" | "ifood";

class MenuItemSellingChannelPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findOneByKey(key: SellingChannelKey) {
    return await this.client.menuItemSellingChannel.findFirst({
      where: {
        key,
      },
    });
  }
}

export const menuItemSellingChannelPrismaEntity =
  new MenuItemSellingChannelPrismaEntity({
    client: prismaClient,
  });
