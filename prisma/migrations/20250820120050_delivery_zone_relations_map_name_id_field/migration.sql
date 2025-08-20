/*
  Warnings:

  - You are about to drop the column `deliveryZoneId` on the `delivery_zone_distance` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryZoneId` on the `kds_daily_order_details` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "delivery_zone_distance" DROP CONSTRAINT "delivery_zone_distance_deliveryZoneId_fkey";

-- DropForeignKey
ALTER TABLE "kds_daily_order_details" DROP CONSTRAINT "kds_daily_order_details_deliveryZoneId_fkey";

-- AlterTable
ALTER TABLE "delivery_zone_distance" DROP COLUMN "deliveryZoneId",
ADD COLUMN     "delivery_zone_id" TEXT;

-- AlterTable
ALTER TABLE "kds_daily_order_details" DROP COLUMN "deliveryZoneId",
ADD COLUMN     "delivery_zone_id" TEXT;

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_distance" ADD CONSTRAINT "delivery_zone_distance_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
