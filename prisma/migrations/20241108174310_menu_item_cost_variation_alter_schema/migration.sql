/*
  Warnings:

  - Made the column `menu_item_id` on table `menu_item_cost_variations` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost_variations" DROP CONSTRAINT "menu_item_cost_variations_menu_item_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost_variations" ALTER COLUMN "menu_item_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
