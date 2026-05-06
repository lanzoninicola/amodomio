ALTER TABLE "financial_monthly_closes"
ADD COLUMN "entrada_investimento_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "saida_investimento_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
