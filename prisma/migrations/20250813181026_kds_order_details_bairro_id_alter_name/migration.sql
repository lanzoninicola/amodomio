/*
  Warnings:

  - You are about to drop the column `bairroId` on the `kds_daily_order_details` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "kds_daily_order_details" DROP CONSTRAINT "kds_daily_order_details_bairroId_fkey";

-- AlterTable
ALTER TABLE "kds_daily_order_details" DROP COLUMN "bairroId",
ADD COLUMN     "bairro_id" TEXT;

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
