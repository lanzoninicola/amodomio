/*
  Warnings:

  - You are about to drop the column `receita_bruta_dia_01_perc` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `receita_bruta_dia_02_perc` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `receita_bruta_dia_03_perc` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `receita_bruta_dia_04_perc` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `receita_bruta_dia_05_perc` on the `financial_summaries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "financial_summaries" DROP COLUMN "receita_bruta_dia_01_perc",
DROP COLUMN "receita_bruta_dia_02_perc",
DROP COLUMN "receita_bruta_dia_03_perc",
DROP COLUMN "receita_bruta_dia_04_perc",
DROP COLUMN "receita_bruta_dia_05_perc";

-- CreateTable
CREATE TABLE "financial_daily_goals" (
    "id" TEXT NOT NULL,
    "is_snapshot" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "target_profit_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_01_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_02_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_03_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_04_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participacao_dia_05_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_goal_dia_01_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_goal_dia_02_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_goal_dia_03_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_goal_dia_04_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_goal_dia_05_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_profit_dia_01_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_profit_dia_02_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_profit_dia_03_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_profit_dia_04_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_profit_dia_05_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_daily_goals_pkey" PRIMARY KEY ("id")
);
