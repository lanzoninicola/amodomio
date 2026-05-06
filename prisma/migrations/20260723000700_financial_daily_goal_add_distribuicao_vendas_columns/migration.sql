-- Step 1: Add new distribuicao_vendas columns (keep legacy participacao columns during transition)
ALTER TABLE "financial_daily_goals"
ADD COLUMN "distribuicao_vendas_dia_01_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_02_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_03_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_04_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_05_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "financial_daily_goal_settings"
ADD COLUMN "distribuicao_vendas_dia_01_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_02_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_03_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_04_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "distribuicao_vendas_dia_05_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
