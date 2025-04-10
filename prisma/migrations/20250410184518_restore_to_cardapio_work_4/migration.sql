-- AlterTable
ALTER TABLE "menu_item_price_variations" ADD COLUMN     "menu_item_size_id" TEXT;

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
