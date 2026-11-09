-- Step 2: Copy legacy values into new columns
UPDATE "financial_daily_goals"
SET
  "min_sales_goal_amount_dia_01" = COALESCE("minimum_goal_dia_01_amount", 0),
  "min_sales_goal_amount_dia_02" = COALESCE("minimum_goal_dia_02_amount", 0),
  "min_sales_goal_amount_dia_03" = COALESCE("minimum_goal_dia_03_amount", 0),
  "min_sales_goal_amount_dia_04" = COALESCE("minimum_goal_dia_04_amount", 0),
  "min_sales_goal_amount_dia_05" = COALESCE("minimum_goal_dia_05_amount", 0),
  "target_sales_goal_amount_dia_01" = COALESCE("target_profit_dia_01_amount", 0),
  "target_sales_goal_amount_dia_02" = COALESCE("target_profit_dia_02_amount", 0),
  "target_sales_goal_amount_dia_03" = COALESCE("target_profit_dia_03_amount", 0),
  "target_sales_goal_amount_dia_04" = COALESCE("target_profit_dia_04_amount", 0),
  "target_sales_goal_amount_dia_05" = COALESCE("target_profit_dia_05_amount", 0);
