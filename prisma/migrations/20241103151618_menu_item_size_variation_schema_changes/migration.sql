/*
  Warnings:

  - You are about to drop the column `menuItemCostVariationId` on the `menu_item_size_variations` table. All the data in the column will be lost.
  - You are about to drop the column `menuItemPriceVariationId` on the `menu_item_size_variations` table. All the data in the column will be lost.
  - Added the required column `menu_item_size_variation_id` to the `menu_item_cost_variations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "menu_item_size_variations" DROP CONSTRAINT "menu_item_size_variations_menuItemCostVariationId_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_size_variations" DROP CONSTRAINT "menu_item_size_variations_menuItemPriceVariationId_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost_variations" ADD COLUMN     "menu_item_size_variation_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "menu_item_price_variations" ADD COLUMN     "menu_item_size_variation_id" TEXT;

-- AlterTable
ALTER TABLE "menu_item_size_variations" DROP COLUMN "menuItemCostVariationId",
DROP COLUMN "menuItemPriceVariationId";

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_size_variation_id_fkey" FOREIGN KEY ("menu_item_size_variation_id") REFERENCES "menu_item_size_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_size_variation_id_fkey" FOREIGN KEY ("menu_item_size_variation_id") REFERENCES "menu_item_size_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
