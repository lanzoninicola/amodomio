import { MenuItemWithAssociations } from "./menu-item.prisma.entity.server";

export default class MenuItemPriceVariationUtility {
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
      MenuItemPriceVariationUtility.getPricesOptions();

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
