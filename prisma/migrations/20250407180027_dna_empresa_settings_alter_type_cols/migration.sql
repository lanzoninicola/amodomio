/*
  Warnings:

  - You are about to alter the column `faturamento_bruto_amount` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `custo_fixo_amount` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `custo_fixo_perc` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `taxa_cartao_perc` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `taxa_marketplace_perc` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `imposto_perc` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `dna_perc` on the `dna_empresa_settings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "dna_empresa_settings" ALTER COLUMN "faturamento_bruto_amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "custo_fixo_amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "custo_fixo_perc" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "taxa_cartao_perc" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "taxa_marketplace_perc" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "imposto_perc" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "dna_perc" SET DATA TYPE DOUBLE PRECISION;
