import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";

export const SELLING_PRICE_REVIEW_PRICE_TOLERANCE = 0.05;

export type SellingPriceReviewStatus =
  | "raise-price"
  | "lower-price"
  | "ok"
  | "missing-sheet";

export type SellingPriceMarginBand =
  | "negative"
  | "0-5"
  | "5-10"
  | "10-15"
  | "above-15"
  | "no-data";

export function calculateSellingPriceProfit(params: {
  priceAmount: number;
  breakdown: ComputedSellingPriceBreakdown;
}) {
  const priceAmount = Number(params.priceAmount || 0);
  const breakdown = params.breakdown;
  const baseCostAmount =
    Number(breakdown.custoFichaTecnica || 0) +
    Number(breakdown.wasteCost || 0) +
    Number(breakdown.packagingCostAmount || 0) +
    Number(breakdown.doughCostAmount || 0);
  const dnaPerc = Number(breakdown.dnaPercentage || 0);
  const dnaAmount = (priceAmount * dnaPerc) / 100;
  const isMarketplace = Boolean(breakdown.channel?.isMarketplace);
  const channelTaxPerc = Number(breakdown.channel?.taxPerc || 0);
  const channelTaxAmount = isMarketplace
    ? (priceAmount * channelTaxPerc) / 100
    : 0;
  const operationalCostAmount = baseCostAmount + dnaAmount + channelTaxAmount;
  const profitAmount = priceAmount - operationalCostAmount;
  const profitPerc = priceAmount > 0 ? (profitAmount / priceAmount) * 100 : 0;

  return {
    baseCostAmount: Number(baseCostAmount.toFixed(2)),
    dnaPerc,
    dnaAmount: Number(dnaAmount.toFixed(2)),
    channelTaxPerc,
    channelTaxAmount: Number(channelTaxAmount.toFixed(2)),
    operationalCostAmount: Number(operationalCostAmount.toFixed(2)),
    profitAmount: Number(profitAmount.toFixed(2)),
    profitPerc: Number(profitPerc.toFixed(2)),
  };
}

export function resolveSellingPriceReviewStatus(params: {
  hasActiveSheet: boolean;
  priceGapAmount: number | null;
  priceTolerance?: number;
}): SellingPriceReviewStatus {
  if (!params.hasActiveSheet) return "missing-sheet";
  const gap = Number(params.priceGapAmount || 0);
  const tolerance = params.priceTolerance ?? SELLING_PRICE_REVIEW_PRICE_TOLERANCE;
  if (gap > tolerance) return "raise-price";
  if (gap < -tolerance) return "lower-price";
  return "ok";
}

export function buildSellingPriceReviewMetrics(params: {
  priceAmount: number;
  breakdown: ComputedSellingPriceBreakdown | null;
  hasActiveSheet: boolean;
}) {
  if (!params.breakdown) {
    return {
      profitSummary: null,
      recalculatedProfitActualPerc: null,
      recommendedPriceAmount: null,
      priceGapAmount: null,
      marginGapPerc: null,
      status: resolveSellingPriceReviewStatus({
        hasActiveSheet: false,
        priceGapAmount: null,
      }),
    };
  }

  const profitSummary = calculateSellingPriceProfit({
    priceAmount: params.priceAmount,
    breakdown: params.breakdown,
  });
  const recommendedPriceAmount =
    params.breakdown.minimumPrice?.priceAmount?.withProfit ?? null;
  const priceGapAmount =
    recommendedPriceAmount == null
      ? null
      : Number((recommendedPriceAmount - Number(params.priceAmount || 0)).toFixed(2));
  const recalculatedProfitActualPerc = profitSummary.profitPerc;
  const marginGapPerc = Number(
    (
      Number(params.breakdown.channel?.targetMarginPerc || 0) -
      recalculatedProfitActualPerc
    ).toFixed(2)
  );

  return {
    profitSummary,
    recalculatedProfitActualPerc,
    recommendedPriceAmount,
    priceGapAmount,
    marginGapPerc,
    status: resolveSellingPriceReviewStatus({
      hasActiveSheet: params.hasActiveSheet,
      priceGapAmount,
    }),
  };
}

export function getSellingPriceMarginBand(
  profitPerc: number | null
): SellingPriceMarginBand {
  if (profitPerc === null) return "no-data";
  if (profitPerc < 0) return "negative";
  if (profitPerc < 5) return "0-5";
  if (profitPerc < 10) return "5-10";
  if (profitPerc < 15) return "10-15";
  return "above-15";
}
