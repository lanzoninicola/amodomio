/*
  Warnings:

  - You are about to drop the column `qty_venda_dia_01_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `qty_venda_dia_02_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `qty_venda_dia_03_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `qty_venda_dia_04_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `qty_venda_dia_05_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `qty_venda_month_amount` on the `financial_summaries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "financial_summaries" DROP COLUMN "qty_venda_dia_01_amount",
DROP COLUMN "qty_venda_dia_02_amount",
DROP COLUMN "qty_venda_dia_03_amount",
DROP COLUMN "qty_venda_dia_04_amount",
DROP COLUMN "qty_venda_dia_05_amount",
DROP COLUMN "qty_venda_month_amount",
ADD COLUMN     "receita_bruta_dia_01_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_bruta_dia_02_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_bruta_dia_03_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_bruta_dia_04_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_bruta_dia_05_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
