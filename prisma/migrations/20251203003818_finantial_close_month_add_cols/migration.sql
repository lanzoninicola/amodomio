-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "custo_fixo_marketing_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_variavel_impostos_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
