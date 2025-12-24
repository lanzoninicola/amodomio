-- AlterTable
ALTER TABLE "financial_monthly_closes"
ADD COLUMN     "receita_dinheiro_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receita_extrato_banco_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
