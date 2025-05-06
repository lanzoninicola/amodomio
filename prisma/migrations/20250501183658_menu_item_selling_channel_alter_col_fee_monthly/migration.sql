/*
  Warnings:

  - You are about to drop the column `monthly_fee_amount` on the `menu_item_selling_channels` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_selling_channels" DROP COLUMN "monthly_fee_amount",
ADD COLUMN     "fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
