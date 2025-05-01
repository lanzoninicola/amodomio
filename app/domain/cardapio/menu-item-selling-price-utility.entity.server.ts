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
  channel: {
    name: string;
    taxPerc: number;
    feeAmount: number;
    isMarketplace: boolean;
    onlinePaymentTaxPerc: number;
  };
  finalPrice: number;
}

export interface ComputedSellingPriceWithChannelTax {
  channelKey: SellingChannelKey;
  sizeKey: PizzaSizeKey;
  priceWithChannelTax: number;
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

    if (!dnaSettings?.targetMarginPerc || dnaSettings?.targetMarginPerc === 0) {
      throw new Error(
        "Verifique as configurações do DNA. A percentagem de margem desejado não está definido"
      );
    }

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
    menuItemId: string,
    channelKey: SellingChannelKey,
    sizeKey: PizzaSizeKey
  ): Promise<ComputedSellingPriceBreakdown> {
    /* ──────── 1. Dados de base ──────── */
    const [channel, itemCost, size, sellingPriceConfig] = await Promise.all([
      this.menuItemSellingChannelEntity.findOneByKey(channelKey),
      this.menuItemCostVariationEntity.findOneCostBySizeKey(
        menuItemId,
        sizeKey
      ),
      this.menuItemSizePrismaEntity.findOneByKey(sizeKey),
      this.getSellingPriceConfig(),
    ]);

    // custo ficha tecnica
    const custoFichaTecnica = itemCost?.costAmount ?? 0;

    /* ──────── 2. Fatores multiplicativos ──────── */
    const wasteFactor = 1 + sellingPriceConfig.wastePercentage / 100;

    const itemTotalCost =
      custoFichaTecnica * wasteFactor + (size?.packagingCostAmount ?? 0);
    const targetMarginPerc = channel?.targetMarginPerc ?? 0;

    let price = 0;

    /* ──────── 3. Calculo preço de venda ──────── */
    price = this.calculateSellingPrice(
      itemTotalCost,
      sellingPriceConfig.dnaPercentage,
      targetMarginPerc
    );

    // se o canal for um marketplace (aiqfome, ifood), o preço de venda é calculado
    if (channel?.isMarketplace) {
      // to define otherCosts
      const otherCosts = 0;
      const channelTaxPerc = channel?.taxPerc ?? 0;

      price = this.calculateSellingPriceForMarketplace(
        price,
        otherCosts,
        channelTaxPerc
      );
    }

    /* ──────── 4. Detalhamento para auditoria ──────── */
    return {
      custoFichaTecnica: Number(custoFichaTecnica.toFixed(2)),
      wasteCost: Number((custoFichaTecnica * (wasteFactor - 1)).toFixed(2)),
      packagingCostAmount: Number((size?.packagingCostAmount ?? 0).toFixed(2)),
      channel: {
        name: channel?.name ?? "",
        taxPerc: channel?.taxPerc ?? 0,
        feeAmount: channel?.feeAmount ?? 0,
        isMarketplace: channel?.isMarketplace ?? false,
        onlinePaymentTaxPerc: channel?.onlinePaymentTaxPerc ?? 0,
      },
      finalPrice: Number((Math.ceil(price / 0.05) * 0.05).toFixed(2)),
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
   * @param targetMarginPerc % lucro desejado
   * @returns preço de venda redondo para cima em 0.05
   */
  calculateSellingPrice(
    amount: number,
    dnaPerc: number,
    targetMarginPerc: number
  ) {
    const divisor = 1 - (dnaPerc / 100 + targetMarginPerc / 100);

    const price = amount / divisor;

    return Number((Math.ceil(price / 0.05) * 0.05).toFixed(2));
  }

  /**
   *
   * @param sellingPrice O preço de venda do produto aplicado no cardápio da loja
   * @param otherCosts Outros custos que o produto tem, como taxa de cartão, taxa de entrega, etc.
   * @param channelTaxPerc a taxa do canal de venda (iFood, site, etc.)
   * @returns  O preço de venda do produto aplicado no canal de venda
   */
  calculateSellingPriceForMarketplace(
    sellingPrice: number,
    otherCosts: number,
    channelTaxPerc: number
  ) {
    const divisor = 1 - channelTaxPerc / 100;

    const price = (sellingPrice + otherCosts) / divisor;

    return Number((Math.ceil(price / 0.05) * 0.05).toFixed(2));
  }
}

export const menuItemSellingPriceUtilityEntity =
  new MenuItemSellingPriceUtilityEntity({
    client: prismaClient,
    menuItemCostVariationEntity: menuItemCostVariationPrismaEntity,
    menuItemSellingChannelEntity: menuItemSellingChannelPrismaEntity,
    menuItemSizePrismaEntity: menuItemSizePrismaEntity,
  });
