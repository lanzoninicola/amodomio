/*
  Warnings:

  - You are about to drop the column `sourdough_base_price_amount` on the `menu_item_sizes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_sizes" DROP COLUMN "sourdough_base_price_amount",
ADD COLUMN     "pizza_dough_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
