import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MenuItemPrismaEntity } from "./menu-item.prisma.entity.server";
import { prismaClient } from "~/lib/prisma/prisma-it.server";

export type MenuItemPriceHTMLSelectLabel =
  | "media"
  | "familia"
  | "fatia"
  | "individual";
export type MenuItemPriceHTMLSelectOption = {
  label: MenuItemPriceHTMLSelectLabel;
  value: string;
};

export class MenuItemPricesPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findByItemId(id: string) {
    return await this.client.menuItemPrice.findMany({
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

  mapPriceLabel(label: string): string {
    if (label === "media") {
      return "Média";
    }

    if (label === "familia") {
      return "Família";
    }

    if (label === "fatia") {
      return "Fatía";
    }

    if (label === "individual") {
      return "Individual";
    }

    return "";
  }
}

const menuItemPricesEntity = new MenuItemPricesPrismaEntity({
  client: prismaClient,
});

export { menuItemPricesEntity };
