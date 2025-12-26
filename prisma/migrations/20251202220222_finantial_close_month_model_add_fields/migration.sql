-- AlterTable
ALTER TABLE "financial_monthly_closes" ADD COLUMN     "margem_contrib_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "margem_contrib_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "resultado_liquido_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "resultado_liquido_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
