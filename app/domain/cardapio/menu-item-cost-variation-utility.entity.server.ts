import { PizzaSizeKey } from "./menu-item-size.entity.server";

export class MenuItemCostVariationUtility {
  /**
   * Calculates the recommended cost variation based on the pizza size key.
   *
   * @param size The key of the pizza size that you want to calculate the cost variation for.
   * @param refCostAmount The base cost amount used to calculate the cost of size variation passed as parameter
   * @returns
   */
  static calculateRecommendedCostVariationBySizeKey(
    size: PizzaSizeKey,
    refCostAmount: number
  ): number {
    switch (size) {
      case "pizza-individual":
        return refCostAmount * 0.5;
      case "pizza-small":
        return refCostAmount * 0.75;
      case "pizza-medium":
        return refCostAmount;
      case "pizza-big":
        return refCostAmount * 1.25;
      case "pizza-bigger":
        return refCostAmount * 2;
      case "pizza-slice":
        return refCostAmount * 0.25;
      default:
        throw new Error("Invalid pizza size");
    }
  }

  /**
   * Calculates all recommended cost variations based on the reference cost amount.
   *
   * @param refCostAmount The base cost amount used to calculate the cost of size variation passed as parameter
   * @returns An object containing the recommended cost variations for each pizza size key.
   */
  static calculateAllRecommendedCostVariations(
    refCostAmount: number
  ): Record<PizzaSizeKey, number> {
    return {
      "pizza-individual": refCostAmount * 0.5,
      "pizza-medium": refCostAmount,
      "pizza-big": refCostAmount * 1.25,
      "pizza-bigger": refCostAmount * 2,
      "pizza-slice": refCostAmount * 0.25,
    };
  }
}

const menuItemCostVariationUtility = new MenuItemCostVariationUtility();
