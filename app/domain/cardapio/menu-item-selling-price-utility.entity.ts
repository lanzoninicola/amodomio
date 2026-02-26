import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import createUUID from "~/utils/uuid";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import {
  SellingChannelKey,
  menuItemSellingChannelPrismaEntity,
} from "./menu-item-selling-channel.entity.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { on } from "events";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import {
  MenuItemCostVariation,
  MenuItemSellingChannel,
  MenuItemSize,
} from "@prisma/client";
import { se } from "date-fns/locale";

interface MenuItemSellingPriceUtilityEntityConstructorProps
  extends PrismaEntityProps {
  menuItemCostVariationEntity: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingChannelEntity: typeof menuItemSellingChannelPrismaEntity;
  menuItemSizePrismaEntity: typeof menuItemSizePrismaEntity;
}

interface SellingPriceConfig {
  /** DNA = custos fixos + taxa de cartão + impostos (%) */
  dnaPercentage: number; // default 0
  /** Quebra / desperdício de insumos (%) */
  wastePercentage: number; // default 0
}

export interface ComputedSellingPriceBreakdown {
  custoFichaTecnica: number;
  wasteCost: number;
  packagingCostAmount: number;
  doughCostAmount: number;
  dnaPercentage: number;
  channel: {
    name: string;
    taxPerc: number;
    feeAmount: number;
    isMarketplace: boolean;
    onlinePaymentTaxPerc: number;
    targetMarginPerc: number; // percentage of profit margin desired
  };
  minimumPrice: SellingPriceAudit;
}

export interface ComputedSellingPriceWithChannelTax {
  channelKey: SellingChannelKey;
  sizeKey: PizzaSizeKey;
  priceWithChannelTax: number;
}

export interface SellingPriceAudit {
  formulaExplanation: string;
  formulaExpression: string;
  priceAmount: {
    withProfit: number;
    // valor que cobre todos os custos, sem lucro
    breakEven: number;
  };
}

class MenuItemSellingPriceUtilityEntity {
  client;

  menuItemCostVariationEntity;

  menuItemSellingChannelEntity;

  menuItemSizePrismaEntity;

  constructor({
    client,
    menuItemCostVariationEntity,
    menuItemSellingChannelEntity,
    menuItemSizePrismaEntity,
  }: MenuItemSellingPriceUtilityEntityConstructorProps) {
    this.client = client;
    this.menuItemCostVariationEntity = menuItemCostVariationEntity;
    this.menuItemSellingChannelEntity = menuItemSellingChannelEntity;
    this.menuItemSizePrismaEntity = menuItemSizePrismaEntity;
  }

  async getSellingPriceConfig(): Promise<SellingPriceConfig> {
    const dnaSettings = await this.client.dnaEmpresaSettings.findFirst();

    return {
      dnaPercentage: dnaSettings?.dnaPerc ?? 0,
      wastePercentage: dnaSettings?.wastePerc ?? 0,
    };
  }

  /**
   * Calculates the selling price of a menu item based on its cost,
   * sales channel fee, and packaging cost.
   *
   * @param menuItemId - The ID of the menu item
   * @param channelKey - The key identifying the sales channel (e.g., iFood, website, etc.)
   * @param sizeKey - The key representing the size variant of the menu item
   * @returns ComputedSellingPriceBreakdown - An object detailing the breakdown of the selling price
   */

  async calculateSellingPriceByChannel(
    channel: MenuItemSellingChannel,
    itemCost: number,
    size: MenuItemSize | null,
    sellingPriceConfig: SellingPriceConfig
  ): Promise<ComputedSellingPriceBreakdown> {
    const custoFichaTecnica = itemCost ?? 0;
    const wasteFactor = 1 + sellingPriceConfig.wastePercentage / 100;

    const itemTotalCost =
      custoFichaTecnica * wasteFactor +
      (size?.pizzaDoughCostAmount ?? 0) +
      (size?.packagingCostAmount ?? 0);
    const targetProfitPerc = channel?.targetMarginPerc ?? 0;

    let price = this.calculateSellingPrice(
      itemTotalCost,
      sellingPriceConfig.dnaPercentage,
      targetProfitPerc
    );

    if (channel?.isMarketplace) {
      // in case there are other costs, like delivery fees or online payment fees,
      const otherCosts = 0;
      const channelTaxPerc = channel?.taxPerc ?? 0;

      // calculate the selling price for marketplace,
      // the calculation of marketplace selling prices starts from the cardapio price
      price = this.calculateSellingPriceForMarketplace(
        price.priceAmount,
        otherCosts,
        channelTaxPerc
      );
    }

    return {
      custoFichaTecnica: Number(custoFichaTecnica.toFixed(2)),
      wasteCost: Number((custoFichaTecnica * (wasteFactor - 1)).toFixed(2)),
      doughCostAmount: Number((size?.pizzaDoughCostAmount ?? 0).toFixed(2)),
      packagingCostAmount: Number((size?.packagingCostAmount ?? 0).toFixed(2)),
      dnaPercentage: sellingPriceConfig.dnaPercentage ?? 0,
      channel: {
        name: channel?.name ?? "",
        taxPerc: channel?.taxPerc ?? 0,
        feeAmount: channel?.feeAmount ?? 0,
        isMarketplace: channel?.isMarketplace ?? false,
        onlinePaymentTaxPerc: channel?.onlinePaymentTaxPerc ?? 0,
        targetMarginPerc: channel?.targetMarginPerc ?? 0,
      },
      minimumPrice: {
        priceAmount: {
          withProfit: formatDecimalPlaces(
            Math.ceil(price.priceAmount.withProfit / 0.05) * 0.05
          ),
          breakEven: formatDecimalPlaces(
            Math.ceil(price.priceAmount.breakEven / 0.05) * 0.05
          ),
        },
        formulaExpression: price.formulaExpression,
        formulaExplanation: price.formulaExplanation,
      },
    };
  }

  /**
   * Calculates the selling price based on curso DNA 2.0
   *
   * Calculco Marketplace
   * https://www.youtube.com/watch?v=-Ris4KjxWrw&list=PL5G6QFIQaDlQOkSW24dvXlxg7FPzi6eNH&index=27
   *
   * @param amount O valor total do custo do item ou o preço de venda em caso de marketplace
   * @param dnaPerc % DNA Empres
   * @param targetProfitPerc % lucro desejado
   * @returns preço de venda redondo para cima em 0.05
   */
  calculateSellingPrice(
    amount: number,
    dnaPerc: number,
    targetProfitPerc: number
  ): SellingPriceAudit {
    const divisor = 1 - (dnaPerc / 100 + targetProfitPerc / 100);
    const priceWithProfit = amount / divisor;

    const divisorWithoutProfit = 1 - dnaPerc / 100;
    const priceWithoutProfit = amount / divisorWithoutProfit;

    return {
      formulaExplanation: `(Custo ficha de custo + Desperdício + Custo embalagem) / (1 - (% Dna + % Profito))`,
      formulaExpression: `(${formatDecimalPlaces(
        amount
      )} / (1 - (${formatDecimalPlaces(dnaPerc)} / 100 + ${formatDecimalPlaces(
        targetProfitPerc
      )} / 100)))`,
      priceAmount: {
        withProfit: formatDecimalPlaces(
          Math.ceil(priceWithProfit / 0.05) * 0.05
        ),
        breakEven: formatDecimalPlaces(
          Math.ceil(priceWithoutProfit / 0.05) * 0.05
        ),
      },
    };
  }

  /**
   *
   * @param basePrice O preço de venda do produto aplicado no cardápio da loja
   * @param otherCosts Outros custos que o produto tem, como taxa de cartão, taxa de entrega, etc.
   * @param channelTaxPerc a taxa do canal de venda (iFood, site, etc.)
   * @returns  O preço de venda do produto aplicado no canal de venda
   */
  calculateSellingPriceForMarketplace(
    basePrice: SellingPriceAudit["priceAmount"],
    otherCosts: number,
    channelTaxPerc: number
  ): SellingPriceAudit {
    const divisor = 1 - channelTaxPerc / 100;

    const priceWithProfit = (basePrice.withProfit + otherCosts) / divisor;

    return {
      formulaExplanation: `(Preço de venda + Outros custos) / (1 - Taxa do canal). O calculo de preço de venda para marketplace começa pelo preço do cardápio`,
      formulaExpression: `(${formatDecimalPlaces(
        basePrice.withProfit
      )} + ${formatDecimalPlaces(otherCosts)}) / (1 - ${channelTaxPerc} / 100)`,
      priceAmount: {
        withProfit: formatDecimalPlaces(
          Math.ceil(priceWithProfit / 0.05) * 0.05
        ),
        breakEven: basePrice.breakEven, // no change for break-even price
      },
    };
  }

  /**
   * Calculates the profit percentage based on the selling price.
   *
   * This function takes into account the base cost of the item,
   * the DNA percentage, and the selling price to compute the profit percentage.
   * * The formula used is:
   * *   profitPerc = 1 - (totalBaseCost / sellingPrice) - (dnaPercentage / 100)
   * * This ensures that the profit percentage is calculated correctly,
   * * and it returns a value that is formatted to two decimal places.
   *
   *
   * @param sellingPrice
   * @param baseCost
   * @param dnaPercentage
   * @returns
   */
  calculateProfitPercFromSellingPrice(
    sellingPrice: number,
    baseCost: {
      fichaTecnicaCostAmount: number;
      packagingCostAmount: number;
      doughCostAmount: number;
      wasteCostAmount: number;
    },
    dnaPercentage: number // Ex: 15 para 15%
  ): number {
    const totalBaseCost =
      baseCost.fichaTecnicaCostAmount +
      baseCost.packagingCostAmount +
      baseCost.doughCostAmount +
      baseCost.wasteCostAmount;

    if (sellingPrice <= 0 || totalBaseCost <= 0) {
      return 0;
    }

    // Ensure dnaPercentage is a valid number between 0 and 100
    const dnaPercDecimal = dnaPercentage / 100;

    // Calculate profit percentage
    const profit = 1 - totalBaseCost / sellingPrice - dnaPercDecimal;

    const profitPercPercentage = profit * 100;

    return formatDecimalPlaces(profitPercPercentage); // Ensure profit percentage is not negative
  }
}

export const menuItemSellingPriceUtilityEntity =
  new MenuItemSellingPriceUtilityEntity({
    client: prismaClient,
    menuItemCostVariationEntity: menuItemCostVariationPrismaEntity,
    menuItemSellingChannelEntity: menuItemSellingChannelPrismaEntity,
    menuItemSizePrismaEntity: menuItemSizePrismaEntity,
  });
