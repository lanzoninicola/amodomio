-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "custo_fixo_folha_funcionarios_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_fixo_prolabore_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
