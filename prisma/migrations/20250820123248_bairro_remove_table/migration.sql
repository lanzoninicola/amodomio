/*
  Warnings:

  - You are about to drop the column `bairro_id` on the `delivery_fees` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryZoneId` on the `delivery_fees` table. All the data in the column will be lost.
  - You are about to drop the column `bairro_id` on the `delivery_zone_distance` table. All the data in the column will be lost.
  - You are about to drop the column `bairro_id` on the `kds_daily_order_details` table. All the data in the column will be lost.
  - You are about to drop the `bairros` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "delivery_fees" DROP CONSTRAINT "delivery_fees_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_fees" DROP CONSTRAINT "delivery_fees_deliveryZoneId_fkey";

-- DropForeignKey
ALTER TABLE "delivery_zone_distance" DROP CONSTRAINT "delivery_zone_distance_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "kds_daily_order_details" DROP CONSTRAINT "kds_daily_order_details_bairro_id_fkey";

-- DropIndex
DROP INDEX "delivery_fees_bairro_id_pizzeria_location_id_key";

-- DropIndex
DROP INDEX "delivery_zone_distance_bairro_id_company_location_id_key";

-- AlterTable
ALTER TABLE "delivery_fees" DROP COLUMN "bairro_id",
DROP COLUMN "deliveryZoneId",
ADD COLUMN     "delivery_zone_id" TEXT;

-- AlterTable
ALTER TABLE "delivery_zone_distance" DROP COLUMN "bairro_id";

-- AlterTable
ALTER TABLE "kds_daily_order_details" DROP COLUMN "bairro_id";

-- DropTable
DROP TABLE "bairros";

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
