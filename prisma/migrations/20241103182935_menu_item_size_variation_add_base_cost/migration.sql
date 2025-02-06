/*
  Warnings:

  - You are about to drop the column `crust_price` on the `menu_item_cost_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "crust_price";

-- AlterTable
ALTER TABLE "menu_item_size_variations" ADD COLUMN     "cost_base" DOUBLE PRECISION NOT NULL DEFAULT 0;
