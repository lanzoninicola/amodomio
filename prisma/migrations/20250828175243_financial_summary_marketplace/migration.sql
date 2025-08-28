-- AlterTable
ALTER TABLE "financial_summaries" ADD COLUMN     "taxa_marketplace_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxa_marketplace_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "venda_marketplace_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
