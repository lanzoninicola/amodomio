/*
  Warnings:

  - You are about to drop the `dna_empresa_settings_snapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "dna_empresa_settings" ADD COLUMN     "custo_variavel_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_snapshot" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "dna_empresa_settings_snapshot";
