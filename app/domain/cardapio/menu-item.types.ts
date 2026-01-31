import {
  MenuItemGroup,
  MenuItemSellingPriceVariationAudit,
} from "@prisma/client";
import { ComputedSellingPriceBreakdown } from "./menu-item-selling-price-utility.entity";
import { PizzaSizeKey } from "./menu-item-size.entity.server";
import { Category } from "../category/category.model.server";

// para custos
export interface MenuItemWithCostVariations {
  menuItemId: string;
  name: string;
  ingredients: string;
  group: MenuItemGroup;
  category: Category;
  visible: boolean;
  active: boolean;
  costVariations: MenuItemCostVariationBySize[];
  warnings?: Warning[];
}

export interface MenuItemCostVariationBySize {
  menuItemCostVariationId: string | undefined;
  sizeId: string;
  sizeKey: string;
  sizeName: string;
  costAmount: number;
  updatedBy: string | null | undefined;
  updatedAt: Date | undefined;
  previousCostAmount: number;
  recommendedCostAmount?: number;
}

export interface SellPriceVariation {
  menuItemSellPriceVariationId?: string;
  sizeId: string;
  sizeKey: PizzaSizeKey | null;
  sizeName: string;
  channelId: string | null;
  channelKey: string | null;
  channelName: string;
  /** efetivo valor de venda publico do cardapio */
  priceAmount: number;
  /** a percentagem do profito realizado com o efetivo valor de venda */
  profitActualPerc: number;
  /** o valor calculado com base a formula do DNA */
  priceExpectedAmount: number;
  /** a percentagem do profito desejada para o canal de venda */
  profitExpectedPerc: number;
  discountPercentage: number;
  showOnCardapio: boolean;
  showOnCardapioAt: Date | null;
  updatedBy?: string;
  updatedAt?: Date;
  previousPriceAmount: number;
  computedSellingPriceBreakdown?: ComputedSellingPriceBreakdown;
  warnings?: Warning[];
  lastAuditRecord?: MenuItemSellingPriceVariationAudit;
  auditRecords?: MenuItemSellingPriceVariationAudit[];
}

export interface MenuItemWithSellPriceVariations {
  menuItemId: string;
  group: MenuItemGroup;
  category: Category;
  name: string;
  sortOrderIndex?: number | null;
  ingredients?: string;
  visible: boolean;
  active: boolean;
  sellPriceVariations: SellPriceVariation[];
  warnings?: Warning[];
}

export interface MenuItemWithSellPriceVariationsAndCostVariations {
  menuItemId: string;
  name: string;
  ingredients?: string;
  visible: boolean;
  active: boolean;
  costVariations: MenuItemCostVariationBySize[];
  sellPriceVariations: SellPriceVariation[];
}

type WarningType = "info" | "alert" | "critical";

export interface Warning {
  type: WarningType;
  code: string;
  message: string;
}
