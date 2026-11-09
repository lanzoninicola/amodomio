-- Step 4: Drop legacy columns after code migration
ALTER TABLE "financial_daily_goals"
DROP COLUMN "minimum_goal_dia_01_amount",
DROP COLUMN "minimum_goal_dia_02_amount",
DROP COLUMN "minimum_goal_dia_03_amount",
DROP COLUMN "minimum_goal_dia_04_amount",
DROP COLUMN "minimum_goal_dia_05_amount",
DROP COLUMN "target_profit_dia_01_amount",
DROP COLUMN "target_profit_dia_02_amount",
DROP COLUMN "target_profit_dia_03_amount",
DROP COLUMN "target_profit_dia_04_amount",
DROP COLUMN "target_profit_dia_05_amount";
