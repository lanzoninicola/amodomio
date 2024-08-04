/*
  Warnings:

  - You are about to drop the column `basePrice` on the `menu_item_price_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_price_variations" DROP COLUMN "basePrice",
ADD COLUMN     "base_price" DOUBLE PRECISION NOT NULL DEFAULT 0;
