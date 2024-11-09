/*
  Warnings:

  - You are about to drop the column `ingredients_cost_amount` on the `menu_item_cost_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "ingredients_cost_amount",
ADD COLUMN     "recipe_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
