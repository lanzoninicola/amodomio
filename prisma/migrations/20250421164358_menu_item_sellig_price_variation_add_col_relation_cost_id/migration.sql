-- AlterTable
ALTER TABLE "menu_item_selling_prices" ADD COLUMN     "cost_variation_id" TEXT;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices" ADD CONSTRAINT "menu_item_selling_prices_cost_variation_id_fkey" FOREIGN KEY ("cost_variation_id") REFERENCES "menu_item_costs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
