import prismaClient from "~/lib/prisma/client.server";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { MenuItemWithCostVariations, Warning } from "./menu-item.types";
import { MenuItemEntityFindAllProps } from "./menu-item.prisma.entity.server";
import { MenuItemCostVariationUtility } from "./menu-item-cost-variation-utility.entity.server";

interface HandleWarningsFnParams {
  costAmount: number;
  previousCostAmount: number;
  recommendedCostAmount: number;
  itemName: string;
  sizeName: string;
}

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

    const sizesResorted = sizes.map((size) => {
      let newSortOrderIndex = size.sortOrderIndex;

      switch (size.key) {
        case "pizza-slice":
          newSortOrderIndex = 1;
          break;
        case "pizza-small":
          newSortOrderIndex = 2;
          break;
        case "pizza-medium":
          newSortOrderIndex = 0;
          break;
        case "pizza-big":
          newSortOrderIndex = 3;
          break;
        case "pizza-bigger":
          newSortOrderIndex = 4;
          break;
      }

      return {
        ...size,
        sortOrderIndex: newSortOrderIndex ?? 0,
      };
    });

    const allReferenceCostVariations = await this.findAllReferenceCost();

    return allMenuItems.map((item) => {
      let itemWarnings: Warning[] = [];

      const costVariations = sizesResorted
        .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
        .map((size) => {
          const variation = item.MenuItemCostVariation?.find(
            (cv) => cv.menuItemSizeId === size.id
          );

          let sizeKey: PizzaSizeKey = this.pizzaSizeKeyRef;
          sizeKey = size.key as PizzaSizeKey;

          const itemReferenceCost = allReferenceCostVariations.find(
            (c) => c.menuItemId === item.id
          );

          const recommendedCostAmount =
            MenuItemCostVariationUtility.calculateRecommendedCostVariationBySizeKey(
              sizeKey,
              itemReferenceCost?.costAmount ?? 0
            );

          let warningsReturned = [];

          if (item.active === true && item.visible === true) {
            warningsReturned = this.handleWarnings({
              costAmount: variation?.costAmount ?? 0,
              previousCostAmount: variation?.previousCostAmount ?? 0,
              recommendedCostAmount,
              itemName: item.name,
              sizeName: size.name,
            });

            if (warningsReturned) {
              itemWarnings = [...itemWarnings, ...warningsReturned];
            }
          }

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
        warnings: itemWarnings,
        costVariations,
      };
    });
  }

  async loadOne(
    menuItemId: string
  ): Promise<MenuItemWithCostVariations | null> {
    const item = await this.client.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        MenuItemCostVariation: true,
      },
    });

    if (!item) return null;

    const sizes = await this.menuItemSize.findAll();
    const allReferenceCostVariations = await this.findAllReferenceCost();

    let itemWarnings: Warning[] = [];

    const costVariations = sizes
      .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
      .map((size) => {
        const variation = item.MenuItemCostVariation?.find(
          (cv) => cv.menuItemSizeId === size.id
        );

        const sizeKey = size.key as PizzaSizeKey;

        const itemReferenceCost = allReferenceCostVariations.find(
          (c) => c.menuItemId === item.id
        );

        const recommendedCostAmount =
          MenuItemCostVariationUtility.calculateRecommendedCostVariationBySizeKey(
            sizeKey,
            itemReferenceCost?.costAmount ?? 0
          );

        let warningsReturned = [];

        if (item.active === true && item.visible === true) {
          warningsReturned = this.handleWarnings({
            costAmount: variation?.costAmount ?? 0,
            previousCostAmount: variation?.previousCostAmount ?? 0,
            recommendedCostAmount,
            itemName: item.name,
            sizeName: size.name,
          });

          if (warningsReturned) {
            itemWarnings = [...itemWarnings, ...warningsReturned];
          }
        }

        return {
          menuItemCostVariationId: variation?.id,
          sizeId: size.id,
          sizeKey,
          sizeName: size.name,
          costAmount: variation?.costAmount ?? 0,
          recommendedCostAmount,
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
      warnings: itemWarnings,
      costVariations,
    };
  }

  /**
   * Finds all cost variations of menu items for the reference size key (pizza-medium).
   *
   * @returns The cost variations of all menu items for the reference size key (pizza-medium).
   */
  async findAllReferenceCost() {
    return await this.menuItemCostVariation.findAllCostBySizeKey(
      this.pizzaSizeKeyRef
    );
  }

  handleWarnings({
    costAmount,
    previousCostAmount,
    recommendedCostAmount,
    itemName,
    sizeName,
  }: HandleWarningsFnParams): Warning[] {
    const warnings: Warning[] = [];

    const base = `${itemName} (${sizeName})`;

    if (costAmount < recommendedCostAmount) {
      warnings.push({
        type: "alert",
        code: "COST_BELOW_RECOMMENDED",
        message: `O custo de ${base} é menor que o custo recomendado.`,
      });
    }

    if (costAmount > recommendedCostAmount) {
      warnings.push({
        type: "info",
        code: "COST_ABOVE_RECOMMENDED",
        message: `O custo de ${base} é maior que o custo recomendado.`,
      });
    }

    if (costAmount === 0) {
      warnings.push({
        type: "critical",
        code: "COST_ZERO",
        message: `O custo de ${base} é zero.`,
      });
    }

    if (costAmount < 0) {
      warnings.push({
        type: "critical",
        code: "COST_NEGATIVE",
        message: `O custo de ${base} é negativo.`,
      });
    }

    if (costAmount > 0 && costAmount < 1) {
      warnings.push({
        type: "info",
        code: "COST_VERY_LOW",
        message: `O custo de ${base} é menor que 1.`,
      });
    }

    if (costAmount > 1000) {
      warnings.push({
        type: "alert",
        code: "COST_TOO_HIGH",
        message: `O custo de ${base} é maior que 1000.`,
      });
    }

    if (previousCostAmount !== 0 && previousCostAmount < costAmount) {
      warnings.push({
        type: "info",
        code: "COST_INCREASED",
        message: `O custo de ${base} foi aumentado de ${previousCostAmount} para ${costAmount}.`,
      });
    }

    return warnings;
  }
}

const menuItemCostHandler = new MenuItemCostHandler({
  client: prismaClient,
  menuItemCostVariation: menuItemCostVariationPrismaEntity,
  menuItemSize: menuItemSizePrismaEntity,
});

export { menuItemCostHandler };
