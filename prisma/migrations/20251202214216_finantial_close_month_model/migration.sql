-- CreateTable
CREATE TABLE "financial_monthly_closes" (
    "id" TEXT NOT NULL,
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "receita_bruta_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "venda_cartao_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "venda_cartao_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_cartao_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_cartao_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imposto_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imposto_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "venda_marketplace_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_marketplace_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_marketplace_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receita_liquida_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_folha_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_aluguel_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_energia_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_software_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_outros_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_insumos_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_embalagens_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_entrega_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_marketing_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_outros_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ponto_equilibrio_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_monthly_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fmc_year_month_idx" ON "financial_monthly_closes"("reference_year", "reference_month");

-- CreateIndex
CREATE UNIQUE INDEX "fmc_year_month_unique" ON "financial_monthly_closes"("reference_year", "reference_month");
