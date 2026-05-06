-- Rename distribuicao_vendas columns to sales_distribution_pct_day columns
-- for both financial_daily_goals and financial_daily_goal_settings.
-- Safe for partially migrated environments.
DO $$
BEGIN
  -- financial_daily_goals
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goals' AND column_name = 'distribuicao_vendas_dia_01_perc'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "distribuicao_vendas_dia_01_perc" TO "sales_distribution_pct_day_01";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goals' AND column_name = 'distribuicao_vendas_dia_02_perc'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "distribuicao_vendas_dia_02_perc" TO "sales_distribution_pct_day_02";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goals' AND column_name = 'distribuicao_vendas_dia_03_perc'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "distribuicao_vendas_dia_03_perc" TO "sales_distribution_pct_day_03";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goals' AND column_name = 'distribuicao_vendas_dia_04_perc'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "distribuicao_vendas_dia_04_perc" TO "sales_distribution_pct_day_04";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goals' AND column_name = 'distribuicao_vendas_dia_05_perc'
  ) THEN
    ALTER TABLE "financial_daily_goals" RENAME COLUMN "distribuicao_vendas_dia_05_perc" TO "sales_distribution_pct_day_05";
  END IF;

  -- financial_daily_goal_settings
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goal_settings' AND column_name = 'distribuicao_vendas_dia_01_perc'
  ) THEN
    ALTER TABLE "financial_daily_goal_settings" RENAME COLUMN "distribuicao_vendas_dia_01_perc" TO "sales_distribution_pct_day_01";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goal_settings' AND column_name = 'distribuicao_vendas_dia_02_perc'
  ) THEN
    ALTER TABLE "financial_daily_goal_settings" RENAME COLUMN "distribuicao_vendas_dia_02_perc" TO "sales_distribution_pct_day_02";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goal_settings' AND column_name = 'distribuicao_vendas_dia_03_perc'
  ) THEN
    ALTER TABLE "financial_daily_goal_settings" RENAME COLUMN "distribuicao_vendas_dia_03_perc" TO "sales_distribution_pct_day_03";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goal_settings' AND column_name = 'distribuicao_vendas_dia_04_perc'
  ) THEN
    ALTER TABLE "financial_daily_goal_settings" RENAME COLUMN "distribuicao_vendas_dia_04_perc" TO "sales_distribution_pct_day_04";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_daily_goal_settings' AND column_name = 'distribuicao_vendas_dia_05_perc'
  ) THEN
    ALTER TABLE "financial_daily_goal_settings" RENAME COLUMN "distribuicao_vendas_dia_05_perc" TO "sales_distribution_pct_day_05";
  END IF;
END $$;
