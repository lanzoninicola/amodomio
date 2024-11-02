/*
  Warnings:

  - You are about to drop the column `label` on the `menu_item_cost_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "label";

-- CreateTable
CREATE TABLE "menu_item_size_variations" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "label" TEXT NOT NULL,
    "menuItemCostVariationId" TEXT,
    "menuItemPriceVariationId" TEXT,

    CONSTRAINT "menu_item_size_variations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_size_variations" ADD CONSTRAINT "menu_item_size_variations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_size_variations" ADD CONSTRAINT "menu_item_size_variations_menuItemCostVariationId_fkey" FOREIGN KEY ("menuItemCostVariationId") REFERENCES "menu_item_cost_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_size_variations" ADD CONSTRAINT "menu_item_size_variations_menuItemPriceVariationId_fkey" FOREIGN KEY ("menuItemPriceVariationId") REFERENCES "menu_item_price_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
