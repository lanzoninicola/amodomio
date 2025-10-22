/*
  Warnings:

  - A unique constraint covering the columns `[delivery_zone_id,company_location_id]` on the table `delivery_zone_distance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "delivery_zone_distance_delivery_zone_id_company_location_id_key" ON "delivery_zone_distance"("delivery_zone_id", "company_location_id");
