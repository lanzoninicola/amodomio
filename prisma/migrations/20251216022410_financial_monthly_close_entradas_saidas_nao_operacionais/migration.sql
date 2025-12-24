-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "entrada_nao_operacional_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "saida_nao_operacional_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
