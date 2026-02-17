-- Step 1: Add new columns (keeps legacy columns for gradual transition)
ALTER TABLE "financial_daily_goals"
ADD COLUMN "min_sales_goal_amount_dia_01" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "min_sales_goal_amount_dia_02" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "min_sales_goal_amount_dia_03" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "min_sales_goal_amount_dia_04" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "min_sales_goal_amount_dia_05" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "target_sales_goal_amount_dia_01" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "target_sales_goal_amount_dia_02" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "target_sales_goal_amount_dia_03" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "target_sales_goal_amount_dia_04" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "target_sales_goal_amount_dia_05" DOUBLE PRECISION NOT NULL DEFAULT 0;
