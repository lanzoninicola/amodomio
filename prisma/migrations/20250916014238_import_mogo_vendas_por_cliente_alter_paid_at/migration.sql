/*
  Warnings:

  - You are about to drop the column `paid_at` on the `import_mogo_vendas_por_cliente` table. All the data in the column will be lost.
  - Added the required column `paid_at_date` to the `import_mogo_vendas_por_cliente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paid_at_hour` to the `import_mogo_vendas_por_cliente` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "import_mogo_vendas_por_cliente" DROP COLUMN "paid_at",
ADD COLUMN     "paid_at_date" TEXT NOT NULL,
ADD COLUMN     "paid_at_hour" TEXT NOT NULL;
