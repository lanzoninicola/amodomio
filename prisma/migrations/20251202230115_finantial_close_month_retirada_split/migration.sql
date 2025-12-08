-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "custo_fixo_retirada_prolabore_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_fixo_retirada_resultado_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
