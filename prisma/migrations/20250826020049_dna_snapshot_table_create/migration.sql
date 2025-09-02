-- CreateTable
CREATE TABLE "dna_empresa_settings_snapshot" (
    "id" TEXT NOT NULL,
    "description" TEXT,
    "faturamento_bruto_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_cartao_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imposto_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dna_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waste_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_variavel_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "dna_empresa_settings_snapshot_pkey" PRIMARY KEY ("id")
);
