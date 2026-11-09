-- Allow FinancialDailyGoal records without a linked FinancialSummary
ALTER TABLE "financial_daily_goals"
ALTER COLUMN "financial_summary_id" DROP NOT NULL;
