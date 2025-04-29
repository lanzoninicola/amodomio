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

interface MenuItemSellingPriceUtilityEntityConstructorProps
  extends PrismaEntityProps {
  menuItemCostVariationEntity: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingChannelEntity: typeof menuItemSellingChannelPrismaEntity;
  menuItemSizePrismaEntity: typeof menuItemSizePrismaEntity;
}

type CoreParams = {
  /** Identificador do item do cardápio (ex.: “margherita-40cm”) */
  menuItemId: string;
  /** Canal de venda (loja física, delivery app, etc.) */
  channelKey: SellingChannelKey;
  /** Tamanho da pizza (médio, família…) */
  sizeKey: PizzaSizeKey;
};

type SellingPriceConfig = {
  /** DNA = custos fixos + taxa de cartão + impostos (%) */
  dnaPercentage: number; // default 0
  /** Mark-up (≠ margem) desejado (%) */
  markupPercentage: number; // default 0
  /** Quebra / desperdício de insumos (%) */
  wastePercentage: number; // default 0
};

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

  /**
   * Calcula a percentagem de mark-up necessária para atingir a margem desejada.
   *
   * @param targetMarginPerc % desejada (15 - 20 etc..)
   * @returns
   */
  calculateMarkupBasedOnTargetMargin(targetMarginPerc: number) {
    const marginFactor = targetMarginPerc / 100;
    const markupFactor = marginFactor / (1 - marginFactor);

    // Ajusta o mark-up para o valor mais próximo de 0,05
    return Math.ceil(markupFactor * 100) * 0.05;
  }

  async getSellingPriceConfig(): Promise<SellingPriceConfig> {
    const dnaSettings = await this.client.dnaEmpresaSettings.findFirst();

    if (!dnaSettings?.targetMarginPerc || dnaSettings?.targetMarginPerc === 0) {
      throw new Error(
        "Verifique as configurações do DNA. A percentagem de margem desejado não está definido"
      );
    }

    const markupPerc = this.calculateMarkupBasedOnTargetMargin(
      dnaSettings?.targetMarginPerc ?? 0
    );

    return {
      dnaPercentage: dnaSettings?.dnaPerc ?? 0,
      markupPercentage: markupPerc,
      wastePercentage: dnaSettings?.wastePerc ?? 0,
    };
  }

  async calculateSellingPrice(
    menuItemId: string,
    channelKey: SellingChannelKey,
    sizeKey: PizzaSizeKey
  ) {
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

    const baseCost = itemCost?.costAmount ?? 0;

    /* ──────── 2. Fatores multiplicativos ──────── */
    const wasteFactor = 1 + sellingPriceConfig.wastePercentage / 100;
    const dnaFactor = 1 + sellingPriceConfig.dnaPercentage / 100;
    const channelFactor = 1 + (channel?.percentageTax ?? 0) / 100;
    const markupFactor = 1 + sellingPriceConfig.markupPercentage / 100;

    /* ──────── 3. Preço calculado ──────── */
    const costWithOverheads =
      baseCost * wasteFactor * dnaFactor + (size?.packagingCostAmount ?? 0);
    const price = costWithOverheads * markupFactor;
    const priceWithChannelTax =
      costWithOverheads * channelFactor * markupFactor;

    /* ──────── 4. Detalhamento para auditoria ──────── */
    return {
      baseCost,
      wasteCost: baseCost * (wasteFactor - 1),
      dnaCost: baseCost * wasteFactor * (dnaFactor - 1),
      packagingCostAmount: size?.packagingCostAmount ?? 0,
      channelCost: costWithOverheads * (channelFactor - 1),
      markupValue: price - costWithOverheads * channelFactor,
      finalPrice: Math.ceil(price / 0.05) * 0.05, // arredonda p/ 5 centavos
      finalPriceWithChannelTax: Math.ceil(priceWithChannelTax / 0.05) * 0.05, // arredonda p/ 5 centavos
    };
  }
}

export const menuItemSellingPriceUtilityEntity =
  new MenuItemSellingPriceUtilityEntity({
    client: prismaClient,
    menuItemCostVariationEntity: menuItemCostVariationPrismaEntity,
    menuItemSellingChannelEntity: menuItemSellingChannelPrismaEntity,
    menuItemSizePrismaEntity: menuItemSizePrismaEntity,
  });
