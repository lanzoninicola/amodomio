export type FinancialDailyGoalCalcInput = {
  pontoEquilibrioAmount: number;
  targetProfitPerc: number;
  salesDistributionPctDay01: number;
  salesDistributionPctDay02: number;
  salesDistributionPctDay03: number;
  salesDistributionPctDay04: number;
  salesDistributionPctDay05: number;
  weekdayCountInMonth?: number;
};

export type FinancialDailyGoalCalcOutput = {
  minSalesGoalAmountDia01: number;
  minSalesGoalAmountDia02: number;
  minSalesGoalAmountDia03: number;
  minSalesGoalAmountDia04: number;
  minSalesGoalAmountDia05: number;
  targetSalesGoalAmountDia01: number;
  targetSalesGoalAmountDia02: number;
  targetSalesGoalAmountDia03: number;
  targetSalesGoalAmountDia04: number;
  targetSalesGoalAmountDia05: number;
};

export function calcFinancialDailyGoalAmounts(
  input: FinancialDailyGoalCalcInput,
): FinancialDailyGoalCalcOutput {
  const {
    pontoEquilibrioAmount,
    targetProfitPerc,
    salesDistributionPctDay01,
    salesDistributionPctDay02,
    salesDistributionPctDay03,
    salesDistributionPctDay04,
    salesDistributionPctDay05,
    weekdayCountInMonth = 4,
  } = input;

  const min = (perc: number) =>
    (pontoEquilibrioAmount * (perc / 100)) / weekdayCountInMonth;
  const mult = 1 + targetProfitPerc / 100;

  const minSalesGoalAmountDia01 = min(salesDistributionPctDay01);
  const minSalesGoalAmountDia02 = min(salesDistributionPctDay02);
  const minSalesGoalAmountDia03 = min(salesDistributionPctDay03);
  const minSalesGoalAmountDia04 = min(salesDistributionPctDay04);
  const minSalesGoalAmountDia05 = min(salesDistributionPctDay05);

  return {
    minSalesGoalAmountDia01,
    minSalesGoalAmountDia02,
    minSalesGoalAmountDia03,
    minSalesGoalAmountDia04,
    minSalesGoalAmountDia05,
    targetSalesGoalAmountDia01: minSalesGoalAmountDia01 * mult,
    targetSalesGoalAmountDia02: minSalesGoalAmountDia02 * mult,
    targetSalesGoalAmountDia03: minSalesGoalAmountDia03 * mult,
    targetSalesGoalAmountDia04: minSalesGoalAmountDia04 * mult,
    targetSalesGoalAmountDia05: minSalesGoalAmountDia05 * mult,
  };
}
