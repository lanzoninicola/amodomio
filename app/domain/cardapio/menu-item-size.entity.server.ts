import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type SizeKey =
  | "pizza-individual"
  | "pizza-small"
  | "pizza-medium"
  | "pizza-big"
  | "pizza-bigger"
  | "pizza-slice";

export type PizzaSizeKey = SizeKey;

class MenuItemSizePrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll() {
    return await this.client.menuItemSize.findMany({
      where: {
        visible: true,
      },
      orderBy: {
        sortOrderIndex: "asc",
      },
    });
  }

  async findOneByKey(key: SizeKey) {
    return await this.client.menuItemSize.findFirst({
      where: {
        key,
      },
    });
  }
}

export const menuItemSizePrismaEntity = new MenuItemSizePrismaEntity({
  client: prismaClient,
});
