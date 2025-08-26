-- CreateTable
CREATE TABLE "financial_summaries" (
    "id" TEXT NOT NULL,
    "is_snapshot" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "faturamento_bruto_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "faturamento_liquido_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custo_fixo_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_month_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_dia_01_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_dia_02_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_dia_03_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_dia_04_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_venda_dia_05_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_summaries_pkey" PRIMARY KEY ("id")
);
