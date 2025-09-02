-- AlterTable
ALTER TABLE "financial_summaries" ADD COLUMN     "custo_variavel_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "custo_variavel_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
