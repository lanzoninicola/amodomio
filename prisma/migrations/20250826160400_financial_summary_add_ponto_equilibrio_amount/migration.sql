/*
  Warnings:

  - You are about to drop the column `faturamento_bruto_amount` on the `financial_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `faturamento_liquido_amount` on the `financial_summaries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "financial_summaries" DROP COLUMN "faturamento_bruto_amount",
DROP COLUMN "faturamento_liquido_amount",
ADD COLUMN     "ponto_equilibrio_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_bruta_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_liquida_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ticket_medio" DOUBLE PRECISION NOT NULL DEFAULT 0;
