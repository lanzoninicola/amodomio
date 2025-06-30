/*
  Warnings:

  - You are about to drop the column `percentage_tax` on the `menu_item_selling_channels` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_selling_channels" DROP COLUMN "percentage_tax",
ADD COLUMN     "monthly_fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sort_order_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tax_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
