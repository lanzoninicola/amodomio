/*
  Warnings:

  - You are about to drop the column `bairro_id` on the `kds_daily_order_details` table. All the data in the column will be lost.
  - You are about to drop the `bairros` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `delivery_fees` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `distance_to_pizzeria` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pizzeria_locations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "delivery_fees" DROP CONSTRAINT "delivery_fees_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_fees" DROP CONSTRAINT "delivery_fees_pizzeria_location_id_fkey";

-- DropForeignKey
ALTER TABLE "distance_to_pizzeria" DROP CONSTRAINT "distance_to_pizzeria_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "distance_to_pizzeria" DROP CONSTRAINT "distance_to_pizzeria_pizzeria_location_id_fkey";

-- DropForeignKey
ALTER TABLE "kds_daily_order_details" DROP CONSTRAINT "kds_daily_order_details_bairro_id_fkey";

-- AlterTable
ALTER TABLE "kds_daily_order_details" DROP COLUMN "bairro_id";

-- DropTable
DROP TABLE "bairros";

-- DropTable
DROP TABLE "delivery_fees";

-- DropTable
DROP TABLE "distance_to_pizzeria";

-- DropTable
DROP TABLE "pizzeria_locations";
