import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type SellingChannelKey = "cardapio" | "ecommerce" | "aiqfome" | "ifood";

class MenuItemSellingChannelPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll() {
    return await this.client.menuItemSellingChannel.findMany({
      orderBy: {
        sortOrderIndex: "asc",
      },
    });
  }

  async findOneByKey(key: SellingChannelKey) {
    return await this.client.menuItemSellingChannel.findFirst({
      where: {
        key,
      },
    });
  }

  async update({ where, data }: Prisma.MenuItemSellingChannelUpdateArgs) {
    return await this.client.menuItemSellingChannel.update({
      where,
      data,
    });
  }
}

export const menuItemSellingChannelPrismaEntity =
  new MenuItemSellingChannelPrismaEntity({
    client: prismaClient,
  });

// Compatibility alias while legacy imports are being normalized.
export const itemSellingChannelPrismaEntity = menuItemSellingChannelPrismaEntity;
