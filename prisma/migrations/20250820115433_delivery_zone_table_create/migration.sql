-- AlterTable
ALTER TABLE "delivery_fees" ADD COLUMN     "deliveryZoneId" TEXT;

-- AlterTable
ALTER TABLE "delivery_zone_distance" ADD COLUMN     "deliveryZoneId" TEXT;

-- AlterTable
ALTER TABLE "kds_daily_order_details" ADD COLUMN     "deliveryZoneId" TEXT;

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_distance" ADD CONSTRAINT "delivery_zone_distance_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
