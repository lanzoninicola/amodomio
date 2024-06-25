/*
  Warnings:

  - Added the required column `discount_percentage` to the `menu_item_price_variations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `featured` to the `menu_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item_price_variations" ADD COLUMN     "discount_percentage" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "featured" BOOLEAN NOT NULL;
