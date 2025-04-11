/*
  Warnings:

  - You are about to drop the column `latestAmount` on the `menu_item_price_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_price_variations" DROP COLUMN "latestAmount",
ADD COLUMN     "latest_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
