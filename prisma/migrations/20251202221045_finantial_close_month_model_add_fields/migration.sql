-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "custo_fixo_parcela_financiamento_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_fixo_retirada_lucro_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
