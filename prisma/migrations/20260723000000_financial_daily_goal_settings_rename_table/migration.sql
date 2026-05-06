-- Rename table to follow snake_case convention used in the schema.
-- This preserves all existing rows.
ALTER TABLE "FinancialDailyGoalSettings"
RENAME TO "financial_daily_goal_settings";

-- Keep primary key constraint naming consistent.
ALTER TABLE "financial_daily_goal_settings"
RENAME CONSTRAINT "FinancialDailyGoalSettings_pkey" TO "financial_daily_goal_settings_pkey";
