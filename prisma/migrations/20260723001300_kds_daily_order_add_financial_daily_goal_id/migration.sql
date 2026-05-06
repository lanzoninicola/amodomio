-- AlterTable
ALTER TABLE "kds_daily_orders"
ADD COLUMN "financial_daily_goal_id" TEXT;

-- CreateIndex
CREATE INDEX "kds_daily_orders_financial_daily_goal_id_idx"
ON "kds_daily_orders"("financial_daily_goal_id");

-- AddForeignKey
ALTER TABLE "kds_daily_orders"
ADD CONSTRAINT "kds_daily_orders_financial_daily_goal_id_fkey"
FOREIGN KEY ("financial_daily_goal_id") REFERENCES "financial_daily_goals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
