/*
  Warnings:

  - You are about to alter the column `moto_value` on the `kds_orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "kds_orders" ALTER COLUMN "moto_value" DROP DEFAULT,
ALTER COLUMN "moto_value" SET DATA TYPE DECIMAL(10,2);
