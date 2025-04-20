/*
  Warnings:

  - You are about to drop the column `menu_item_size__id` on the `menu_item_price_variations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_price_variations" DROP CONSTRAINT "menu_item_price_variations_menu_item_size__id_fkey";

-- AlterTable
ALTER TABLE "grocery_list_items" ADD COLUMN     "purchased" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "menu_item_price_variations" DROP COLUMN "menu_item_size__id",
ADD COLUMN     "menu_item_size_id" TEXT;

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
