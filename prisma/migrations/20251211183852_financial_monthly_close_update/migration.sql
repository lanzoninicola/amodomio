/*
  Warnings:

  - You are about to drop the column `custo_variavel_embalagens_amount` on the `financial_monthly_closes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "financial_monthly_closes" DROP COLUMN "custo_variavel_embalagens_amount",
ADD COLUMN     "custo_fixo_assessoria_marketing_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_fixo_plano_saude_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_fixo_trafego_pago_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
