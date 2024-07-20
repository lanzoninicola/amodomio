import { PrismaEntityProps } from "~/lib/prisma/types.server";
import {
  MenuItemPrismaEntity,
  MenuItemWithAssociations,
} from "./menu-item.prisma.entity.server";
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
    return await this.client.menuItemPriceVariation.upsert({
      where: { id },
      create: data,
      update: data,
    });
  }

  async findByItemId(id: string) {
    return await this.client.menuItemPriceVariation.findMany({
      where: { menuItemId: id },
    });
  }

  async findByIdAndVariation(id: string, variation: string) {
    return await this.client.menuItemPriceVariation.findFirst({
      where: { menuItemId: id, label: variation.toLocaleLowerCase() },
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

  static getInitialPriceVariations(): MenuItemWithAssociations["priceVariations"] {
    const initialPriceVariations =
      MenuItemPriceVariationPrismaEntity.getPricesOptions();

    return initialPriceVariations.map((p) => ({
      amount: 0,
      label: p.label,
      discountPercentage: 0,
      createdAt: new Date(),
      id: "",
      menuItemId: "",
      basePrice: 0,
      showOnCardapio: false,
      updatedAt: new Date(),
    }));
  }
}

const menuItemPriceVariationsEntity = new MenuItemPriceVariationPrismaEntity({
  client: prismaClient,
});

export { menuItemPriceVariationsEntity };
