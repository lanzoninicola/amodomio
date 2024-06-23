import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MenuItemPrismaEntity } from "./menu-item.prisma.entity.server";
import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { MenuItemPriceVariation } from "@prisma/client";

export type MenuItemPriceVariationLabel =
  | "media"
  | "familia"
  | "fatia"
  | "individual";
export type MenuItemPriceVariationsOptions = {
  label: MenuItemPriceVariationLabel;
  value: string;
};

export class MenuItemPriceVariationsPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findByItemId(id: string) {
    return await this.client.menuItemPriceVariation.findMany({
      where: { menuItemId: id },
    });
  }

  static getPricesOptions() {
    return [
      { label: "media", value: "Média" },
      { label: "familia", value: "Família" },
      { label: "fatia", value: "Fatía" },
      { label: "individual", value: "Individual" },
    ];
  }
}

const menuItemPricesEntity = new MenuItemPriceVariationsPrismaEntity({
  client: prismaClient,
});

export { menuItemPricesEntity };
