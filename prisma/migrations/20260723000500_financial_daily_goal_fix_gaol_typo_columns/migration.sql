-- Fix typo in column names: gaol -> goal (safe for partially migrated databases)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_daily_goals'
      AND column_name = 'target_sales_gaol_amount_dia_01'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "target_sales_gaol_amount_dia_01" TO "target_sales_goal_amount_dia_01";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_daily_goals'
      AND column_name = 'target_sales_gaol_amount_dia_02'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "target_sales_gaol_amount_dia_02" TO "target_sales_goal_amount_dia_02";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_daily_goals'
      AND column_name = 'target_sales_gaol_amount_dia_03'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "target_sales_gaol_amount_dia_03" TO "target_sales_goal_amount_dia_03";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_daily_goals'
      AND column_name = 'target_sales_gaol_amount_dia_04'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "target_sales_gaol_amount_dia_04" TO "target_sales_goal_amount_dia_04";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_daily_goals'
      AND column_name = 'target_sales_gaol_amount_dia_05'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "target_sales_gaol_amount_dia_05" TO "target_sales_goal_amount_dia_05";
  END IF;
END $$;
