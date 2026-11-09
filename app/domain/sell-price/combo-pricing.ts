export type ComboPricingMode =
  | "PERCENTAGE_DISCOUNT"
  | "FIXED_DISCOUNT"
  | "FIXED_PRICE";

export type ComboPricingStatus =
  | "HEALTHY"
  | "BELOW_TARGET_MARGIN"
  | "BELOW_BREAK_EVEN";

export type ComboPricingLine = {
  unitPrice: number | null;
  unitCost: number | null;
  quantity: number;
  isValidForSale?: boolean;
  invalidReasons?: string[];
};

export type ComboPricingInput = {
  lines: ComboPricingLine[];
  pricingMode: ComboPricingMode;
  discountPercentage?: number;
  discountAmount?: number;
  fixedPriceAmount?: number;
  dnaPerc: number;
  targetMarginPerc: number;
};

export type ComboPricingAnalysis = {
  individualTotalPrice: number;
  comboPrice: number;

  equivalentDiscountAmount: number;
  equivalentDiscountPercentage: number;

  comboTotalCost: number;

  dnaPerc: number;
  dnaAmount: number;

  operationalCost: number;
  profitAmount: number;
  profitPerc: number;

  breakEvenPrice: number;
  recommendedPrice: number;
  targetMarginPerc: number;

  status: ComboPricingStatus;
  isValidForSale: boolean;

  invalidReasons: string[];
};

export type ComboSaleScenario = {
  priceAmount: number;
  totalCost: number;
  dnaAmount: number;
  operationalCost: number;
  profitAmount: number;
  profitPerc: number;
};

export type ComboSalesComparison = {
  individualSale: ComboSaleScenario;
  comboSale: ComboSaleScenario;
  priceDeltaAmount: number;
  profitDeltaAmount: number;
  profitDeltaPerc: number;
  marginDeltaPerc: number;
};

const PRICE_STEP = 0.05;

function toMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function normalizeRate(percentValue: number) {
  const value = Number(percentValue || 0);
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

export function roundPriceUpToStep(value: number, step = PRICE_STEP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return toMoney(Math.ceil(value / step) * step);
}

function divideSafely(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function resolveComboPrice(params: {
  individualTotalPrice: number;
  pricingMode: ComboPricingMode;
  discountPercentage?: number;
  discountAmount?: number;
  fixedPriceAmount?: number;
}) {
  const individualTotalPrice = Number(params.individualTotalPrice || 0);

  if (params.pricingMode === "PERCENTAGE_DISCOUNT") {
    const discountRate = Math.min(Math.max(normalizeRate(Number(params.discountPercentage || 0)), 0), 1);
    return individualTotalPrice * (1 - discountRate);
  }

  if (params.pricingMode === "FIXED_DISCOUNT") {
    return individualTotalPrice - Math.max(0, Number(params.discountAmount || 0));
  }

  return Math.max(0, Number(params.fixedPriceAmount || 0));
}

function resolveInvalidReasons(lines: ComboPricingLine[]) {
  const reasons = new Set<string>();

  if (lines.length === 0) {
    reasons.add("Adicione ao menos um item ao combo.");
  }

  for (const line of lines) {
    if (line.isValidForSale === false) {
      for (const reason of line.invalidReasons || []) {
        reasons.add(reason);
      }
    }
    if (line.unitPrice == null || Number(line.unitPrice || 0) <= 0) {
      reasons.add("Existe item sem preco salvo no canal proprio.");
    }
    if (line.unitCost == null) {
      reasons.add("Existe item sem ficha tecnica ativa.");
    }
    if (Number(line.quantity || 0) <= 0) {
      reasons.add("Existe item com quantidade invalida.");
    }
  }

  return Array.from(reasons);
}

export function buildComboSalesComparison(params: {
  individualTotalPrice: number;
  comboPrice: number;
  comboTotalCost: number;
  dnaPerc: number;
}): ComboSalesComparison {
  const dnaRate = normalizeRate(params.dnaPerc);

  const buildScenario = (priceAmount: number): ComboSaleScenario => {
    const normalizedPrice = toMoney(priceAmount);
    const totalCost = toMoney(params.comboTotalCost);
    const dnaAmount = toMoney(normalizedPrice * dnaRate);
    const operationalCost = toMoney(totalCost + dnaAmount);
    const profitAmount = toMoney(normalizedPrice - operationalCost);
    const profitPerc = toMoney(divideSafely(profitAmount, normalizedPrice) * 100);

    return {
      priceAmount: normalizedPrice,
      totalCost,
      dnaAmount,
      operationalCost,
      profitAmount,
      profitPerc,
    };
  };

  const individualSale = buildScenario(params.individualTotalPrice);
  const comboSale = buildScenario(params.comboPrice);
  const priceDeltaAmount = toMoney(comboSale.priceAmount - individualSale.priceAmount);
  const profitDeltaAmount = toMoney(comboSale.profitAmount - individualSale.profitAmount);
  const profitDeltaPerc = toMoney(divideSafely(profitDeltaAmount, individualSale.profitAmount) * 100);
  const marginDeltaPerc = toMoney(comboSale.profitPerc - individualSale.profitPerc);

  return {
    individualSale,
    comboSale,
    priceDeltaAmount,
    profitDeltaAmount,
    profitDeltaPerc,
    marginDeltaPerc,
  };
}

export function analyzeComboPricing(params: ComboPricingInput): ComboPricingAnalysis {
  const lines = params.lines || [];
  const individualTotalPrice = toMoney(
    lines.reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0), 0)
  );
  const comboTotalCost = toMoney(
    lines.reduce((sum, line) => sum + Number(line.unitCost || 0) * Number(line.quantity || 0), 0)
  );
  const comboPrice = toMoney(
    Math.max(
      0,
      resolveComboPrice({
        individualTotalPrice,
        pricingMode: params.pricingMode,
        discountPercentage: params.discountPercentage,
        discountAmount: params.discountAmount,
        fixedPriceAmount: params.fixedPriceAmount,
      })
    )
  );

  const equivalentDiscountAmount = toMoney(individualTotalPrice - comboPrice);
  const equivalentDiscountPercentage = toMoney(divideSafely(equivalentDiscountAmount, individualTotalPrice) * 100);
  const dnaPerc = Number(params.dnaPerc || 0);
  const targetMarginPerc = Number(params.targetMarginPerc || 0);
  const dnaRate = normalizeRate(dnaPerc);
  const targetMarginRate = normalizeRate(targetMarginPerc);
  const dnaAmount = toMoney(comboPrice * dnaRate);
  const operationalCost = toMoney(comboTotalCost + dnaAmount);
  const profitAmount = toMoney(comboPrice - operationalCost);
  const profitPerc = toMoney(divideSafely(profitAmount, comboPrice) * 100);
  const breakEvenDivisor = 1 - dnaRate;
  const recommendedDivisor = 1 - (dnaRate + targetMarginRate);
  const breakEvenPrice = roundPriceUpToStep(divideSafely(comboTotalCost, breakEvenDivisor));
  const recommendedPrice = roundPriceUpToStep(divideSafely(comboTotalCost, recommendedDivisor));
  const status: ComboPricingStatus =
    comboPrice < breakEvenPrice
      ? "BELOW_BREAK_EVEN"
      : profitPerc < targetMarginPerc
        ? "BELOW_TARGET_MARGIN"
        : "HEALTHY";
  const invalidReasons = resolveInvalidReasons(lines);

  return {
    individualTotalPrice,
    comboPrice,
    equivalentDiscountAmount,
    equivalentDiscountPercentage,
    comboTotalCost,
    dnaPerc,
    dnaAmount,
    operationalCost,
    profitAmount,
    profitPerc,
    breakEvenPrice,
    recommendedPrice,
    targetMarginPerc,
    status,
    isValidForSale: invalidReasons.length === 0,
    invalidReasons,
  };
}
