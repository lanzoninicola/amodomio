import prismaClient from "~/lib/prisma/client.server";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { MenuItemWithCostVariations } from "./menu-item.types";
import { MenuItemEntityFindAllProps } from "./menu-item.prisma.entity.server";

class MenuItemCostHandler {
  pizzaSizeKeyRef: PizzaSizeKey = "pizza-medium";

  client;
  menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;
  menuItemSize: typeof menuItemSizePrismaEntity;

  constructor({
    client,
    menuItemCostVariation,
    menuItemSize,
  }: {
    client: any;
    menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;
    menuItemSize: typeof menuItemSizePrismaEntity;
  }) {
    this.client = client;
    this.menuItemCostVariation = menuItemCostVariation;
    this.menuItemSize = menuItemSize;
  }

  async loadAll(
    params: MenuItemEntityFindAllProps = {}
  ): Promise<MenuItemWithCostVariations[]> {
    const allMenuItems = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
        MenuItemCostVariation: true,
      },
      orderBy: { sortOrderIndex: "asc" },
    });

    const sizes = await this.menuItemSize.findAll();

    // array of medium size cost variations for all items
    const allReferenceCostVariations = await this.findAllReferenceCost();

    return allMenuItems.map((item) => {
      const costVariations = sizes
        .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
        .map((size) => {
          const variation = item.MenuItemCostVariation?.find(
            (cv) => cv.menuItemSizeId === size.id
          );

          let sizeKey: PizzaSizeKey = this.pizzaSizeKeyRef; // Default size key
          sizeKey = size.key as PizzaSizeKey;

          const itemReferenceCost = allReferenceCostVariations.find(
            (c) => c.menuItemId === item.id
          );

          const recommendedCostAmount =
            this.calculateRecommendedCostVariationBySizeKey(
              sizeKey,
              itemReferenceCost?.costAmount ?? 0
            );

          return {
            menuItemCostVariationId: variation?.id,
            sizeId: size.id,
            sizeKey,
            sizeName: size.name,
            costAmount: variation?.costAmount ?? 0,
            recommendedCostAmount: recommendedCostAmount ?? 0,
            updatedBy: variation?.updatedBy,
            updatedAt: variation?.updatedAt,
            previousCostAmount: variation?.previousCostAmount ?? 0,
          };
        });

      return {
        menuItemId: item.id,
        name: item.name,
        ingredients: item.ingredients,
        visible: item.visible,
        active: item.active,
        costVariations,
      };
    });
  }

  /**
   *
   * Calcula o custo recomendado para cada tamanho de pizza com base no custo da pizza de tamanho médio.
   *
   * @param size O tamanho da pizza para o qual o custo recomendado deve ser calculado.
   * @param refCostAmount O custo de referência é o custo do tamanho médio no momento
   * @returns
   */
  calculateRecommendedCostVariationBySizeKey(
    size: PizzaSizeKey,
    refCostAmount: number
  ): number {
    switch (size) {
      case "pizza-small":
        return refCostAmount * 0.5;
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
   * Find all cost variations for the reference size key.
   *
   * Other costs are calculated based on this reference size key.
   * At this moment, the reference size key is "pizza-medium".
   *
   * @returns
   */
  async findAllReferenceCost() {
    return await this.menuItemCostVariation.findAllCostBySizeKey(
      this.pizzaSizeKeyRef
    );
  }
}

const menuItemCostHandler = new MenuItemCostHandler({
  client: prismaClient,
  menuItemCostVariation: menuItemCostVariationPrismaEntity,
  menuItemSize: menuItemSizePrismaEntity,
});

export { menuItemCostHandler };
