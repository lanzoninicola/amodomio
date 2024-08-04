import { MenuItemPriceVariation } from "@prisma/client";
import { MenuItemWithAssociations } from "./menu-item.prisma.entity.server";
import { v4 as uuidv4 } from "uuid";

export default class MenuItemPriceVariationUtility {
  static getPricesOptions() {
    return [
      { label: "fatia", value: "Fatía" },
      { label: "individual", value: "Individual" },
      { label: "media", value: "Média" },
      { label: "familia", value: "Família" },
    ];
  }

  static getInitialPriceVariations(
    itemId: string = ""
  ): MenuItemWithAssociations["priceVariations"] {
    const initialPriceVariations =
      MenuItemPriceVariationUtility.getPricesOptions();

    return initialPriceVariations.map((p) => ({
      amount: 0,
      label: p.label,
      discountPercentage: 0,
      createdAt: new Date(),
      id: uuidv4(),
      menuItemId: itemId,
      basePrice: 0,
      showOnCardapio: false,
      updatedAt: new Date(),
    }));
  }

  static calculatePriceVariations(
    basePrice: number,
    itemId: string
  ): Omit<MenuItemPriceVariation, "menuItemId">[] {
    const familiaAmount: Record<string, number> = {
      "69.9": 149.9,
      "79.9": 159.9,
      "89.9": 179.9,
      "99.9": 189.9,
      "109.9": 209.9,
      "119.9": 219.9,
    };

    return MenuItemPriceVariationUtility.getInitialPriceVariations(itemId).map(
      (pv: MenuItemPriceVariation) => {
        let amount = basePrice;
        let showOnCardapio = true;

        switch (pv.label) {
          case "individual":
          case "fatia":
            amount = 0;
            break;
          case "familia":
            amount = familiaAmount[basePrice.toString()] || 0;
            break;
        }

        switch (pv.label) {
          case "individual":
          case "fatia":
            showOnCardapio = false;
            break;
          case "media":
          case "familia":
            showOnCardapio = true;
            break;
        }

        const nextData: Omit<MenuItemPriceVariation, "menuItemId"> = {
          amount,
          label: pv.label,
          basePrice,
          createdAt: pv.createdAt,
          id: pv.id,
          discountPercentage: pv.discountPercentage,
          showOnCardapio,
          updatedAt: pv.updatedAt,
        };

        return nextData;
      }
    );
  }
}
