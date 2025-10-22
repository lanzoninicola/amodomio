-- AlterTable
ALTER TABLE "kds_daily_orders" ADD COLUMN     "minimum_goal_profit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "target_goal_profit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
