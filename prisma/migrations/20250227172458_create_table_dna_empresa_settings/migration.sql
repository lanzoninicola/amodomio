-- CreateTable
CREATE TABLE "dna_empresa_settings" (
    "id" TEXT NOT NULL,
    "faturamento_bruto_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "custo_fixo_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "custo_fixo_perc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxa_cartao_perc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxa_marketplace_perc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "imposto_perc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dna_perc" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "dna_empresa_settings_pkey" PRIMARY KEY ("id")
);
