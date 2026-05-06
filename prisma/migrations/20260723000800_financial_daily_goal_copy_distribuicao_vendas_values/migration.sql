-- Step 2: Copy legacy participacao values into distribuicao_vendas columns
UPDATE "financial_daily_goals"
SET
  "distribuicao_vendas_dia_01_perc" = COALESCE("participacao_dia_01_perc", 0),
  "distribuicao_vendas_dia_02_perc" = COALESCE("participacao_dia_02_perc", 0),
  "distribuicao_vendas_dia_03_perc" = COALESCE("participacao_dia_03_perc", 0),
  "distribuicao_vendas_dia_04_perc" = COALESCE("participacao_dia_04_perc", 0),
  "distribuicao_vendas_dia_05_perc" = COALESCE("participacao_dia_05_perc", 0);

UPDATE "financial_daily_goal_settings"
SET
  "distribuicao_vendas_dia_01_perc" = COALESCE("participacao_dia_01_perc", 0),
  "distribuicao_vendas_dia_02_perc" = COALESCE("participacao_dia_02_perc", 0),
  "distribuicao_vendas_dia_03_perc" = COALESCE("participacao_dia_03_perc", 0),
  "distribuicao_vendas_dia_04_perc" = COALESCE("participacao_dia_04_perc", 0),
  "distribuicao_vendas_dia_05_perc" = COALESCE("participacao_dia_05_perc", 0);
