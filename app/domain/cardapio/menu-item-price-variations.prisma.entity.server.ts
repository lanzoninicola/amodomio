import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MenuItemPrismaEntity } from "./menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { MenuItemPriceVariation, Prisma } from "@prisma/client";

export type MenuItemPriceVariationLabel =
  | "media"
  | "familia"
  | "fatia"
  | "individual";
export type MenuItemPriceVariationsOptions = {
  label: MenuItemPriceVariationLabel;
  value: string;
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

  async update(id: string, data: Prisma.MenuItemPriceVariationUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItemPriceVariation.update({
      where: { id },
      data,
    });
  }

  async findByItemId(id: string) {
    return await this.client.menuItemPriceVariation.findMany({
      where: { menuItemId: id },
    });
  }

  static getPricesOptions() {
    return [
      { label: "fatia", value: "Fatía" },
      { label: "individual", value: "Individual" },
      { label: "media", value: "Média" },
      { label: "familia", value: "Família" },
    ];
  }

  static getInitialPriceVariations() {
    const initialPriceVariations =
      MenuItemPriceVariationPrismaEntity.getPricesOptions();

    return initialPriceVariations.map((p) => ({
      amount: 0,
      label: p.label,
      discountPercentage: 0,
      createdAt: new Date().toISOString(),
    }));
  }
}

const menuItemPriceVariationsEntity = new MenuItemPriceVariationPrismaEntity({
  client: prismaClient,
});

export { menuItemPriceVariationsEntity };
