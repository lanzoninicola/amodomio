-- DropForeignKey
ALTER TABLE "financial_daily_goals" DROP CONSTRAINT "financial_daily_goals_financial_summary_id_fkey";

-- AddForeignKey
ALTER TABLE "financial_daily_goals" ADD CONSTRAINT "financial_daily_goals_financial_summary_id_fkey" FOREIGN KEY ("financial_summary_id") REFERENCES "financial_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
