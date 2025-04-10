import { PrismaEntityProps } from "~/lib/prisma/types.server";
import prismaClient from "~/lib/prisma/client.server";
import { MenuItemPriceVariation, Prisma } from "@prisma/client";
import createUUID from "~/utils/uuid";

export type MenuItemPriceVariationValue =
  | "Tamanho Individual"
  | "Tamanho Médio"
  | "Tamanho Família"
  | "Aiqfome"
  | "Ifood";

export type MenuItemPriceVariationIndex =
  | "individual"
  | "medio"
  | "familia"
  | "aiqfome"
  | "ifood";
export type MenuItemPriceVariationsOptions = {
  value: MenuItemPriceVariationValue;
  index: MenuItemPriceVariationIndex;
};

export type PartialMenuItemPriceVariation = Omit<
  MenuItemPriceVariation,
  "createdAt" | "updatedAt" | "menuItemId"
>;

export class MenuItemPriceVariationPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll() {
    return await this.client.menuItemPriceVariation.findMany({
      include: {
        MenuItem: {
          select: {
            id: true,
            name: true,
            ingredients: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.MenuItemPriceVariationCreateInput) {
    return await this.client.menuItemPriceVariation.create({ data });
  }

  async update(id: string, data: Prisma.MenuItemPriceVariationUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItemPriceVariation.update({
      where: { id },
      data,
    });
  }

  async upsert(id: string, data: Prisma.MenuItemPriceVariationCreateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    if (!data.createdAt) {
      data.createdAt = new Date().toISOString();
    }

    // find the record
    const record = await this.client.menuItemPriceVariation.findFirst({
      where: { id },
    });

    if (record) {
      // if the record exists, update it
      return await this.client.menuItemPriceVariation.update({
        where: { id },
        data,
      });
    }

    // if the record does not exist, create it
    data.id = createUUID();

    return await this.create(data);
  }

  async findByItemId(id: string) {
    return await this.client.menuItemPriceVariation.findMany({
      where: { menuItemId: id },
      include: {
        MenuItem: {
          select: {
            id: true,
            name: true,
            ingredients: true,
          },
        },
      },
    });
  }

  async findByItemIdAndVariation(menuItemId: string, variation: string) {
    return await this.client.menuItemPriceVariation.findFirst({
      where: { menuItemId: menuItemId, label: variation.toLocaleLowerCase() },
    });
  }
}

const menuItemPriceVariationsEntity = new MenuItemPriceVariationPrismaEntity({
  client: prismaClient,
});

export { menuItemPriceVariationsEntity };
