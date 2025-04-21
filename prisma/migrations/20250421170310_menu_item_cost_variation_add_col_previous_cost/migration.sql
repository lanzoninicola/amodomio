/*
  Warnings:

  - You are about to drop the column `previous_cost` on the `menu_item_costs` table. All the data in the column will be lost.
  - You are about to drop the column `latestAmount` on the `menu_item_selling_prices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_costs" DROP COLUMN "previous_cost",
ADD COLUMN     "previous_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "menu_item_selling_prices" DROP COLUMN "latestAmount",
ADD COLUMN     "previous_selling_price" DOUBLE PRECISION NOT NULL DEFAULT 0;
