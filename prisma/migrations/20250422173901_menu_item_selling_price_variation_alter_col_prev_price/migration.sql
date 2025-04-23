/*
  Warnings:

  - You are about to drop the column `previous_selling_price` on the `menu_item_selling_prices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_selling_prices" DROP COLUMN "previous_selling_price",
ADD COLUMN     "previous_price_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
