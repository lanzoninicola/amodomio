import {
  MenuItemPriceVariationLabel,
  PartialMenuItemPriceVariation,
} from "./menu-item-price-variations.prisma.entity.server";

export function mapPriceVariationsLabel(label: string): string {
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

  return "Não definido";
}

export function suggestPriceVariations(
  variation: MenuItemPriceVariationLabel,
  priceRef: number
): number {
  const priceRanges: Record<string, number[]> = {
    "69.9": [69.9, 149.9],
    "79.9": [79.9, 159.9],
    "89.9": [89.9, 179.9],
    "99.9": [99.9, 189.9],
    "119.9": [119.9, 219.9],
  };

  const range = priceRanges[String(priceRef)];

  const media = range ? range[0] : 0;
  const familia = range ? range[1] : 0;
  const individual = priceRef > 0 ? priceRef / 1.75 : 0;
  const fatia = priceRef > 0 ? familia / 8 : 0;

  const suggestPrice = {
    media: media,
    familia: familia,
    individual: individual,
    fatia: fatia,
  };

  return suggestPrice[variation] ? suggestPrice[variation] : 0;
}

export function defaultItemsPriceVariations(): PartialMenuItemPriceVariation[] {
  return [
    {
      id: "1",
      label: "media",

      basePrice: 0,
      amount: 0,
      discountPercentage: 0,
    },
    {
      id: "2",
      label: "familia",
      basePrice: 0,
      amount: 0,
      discountPercentage: 0,
    },
    {
      id: "3",
      label: "individual",
      basePrice: 0,
      amount: 0,
      discountPercentage: 0,
    },
    {
      id: "4",
      label: "fatia",
      basePrice: 0,
      amount: 0,
      discountPercentage: 0,
    },
  ];
}
