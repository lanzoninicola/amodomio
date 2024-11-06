/*
  Warnings:

  - You are about to drop the column `ingredient_price` on the `menu_item_cost_variations` table. All the data in the column will be lost.
  - You are about to drop the column `costScalingFactor` on the `menu_item_size_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "ingredient_price",
ADD COLUMN     "ingredients_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "menu_item_size_variations" DROP COLUMN "costScalingFactor",
ADD COLUMN     "cost_scaling_factor" DOUBLE PRECISION NOT NULL DEFAULT 1;
