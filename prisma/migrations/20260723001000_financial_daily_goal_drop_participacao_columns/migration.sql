-- Step 4: Drop legacy participacao columns after code migration
ALTER TABLE "financial_daily_goals"
DROP COLUMN "participacao_dia_01_perc",
DROP COLUMN "participacao_dia_02_perc",
DROP COLUMN "participacao_dia_03_perc",
DROP COLUMN "participacao_dia_04_perc",
DROP COLUMN "participacao_dia_05_perc";

ALTER TABLE "financial_daily_goal_settings"
DROP COLUMN "participacao_dia_01_perc",
DROP COLUMN "participacao_dia_02_perc",
DROP COLUMN "participacao_dia_03_perc",
DROP COLUMN "participacao_dia_04_perc",
DROP COLUMN "participacao_dia_05_perc";
