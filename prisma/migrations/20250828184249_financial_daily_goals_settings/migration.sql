-- CreateTable
CREATE TABLE "FinancialDailyGoalSettings" (
    "id" TEXT NOT NULL,
    "target_profit_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_01_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_02_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_03_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_04_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_05_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "FinancialDailyGoalSettings_pkey" PRIMARY KEY ("id")
);
