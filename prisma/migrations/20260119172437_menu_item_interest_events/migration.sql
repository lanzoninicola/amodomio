-- DropForeignKey
ALTER TABLE "menu_item_interest_events" DROP CONSTRAINT "menu_item_interest_events_menu_item_id_fkey";

-- AddForeignKey
ALTER TABLE "menu_item_interest_events" ADD CONSTRAINT "menu_item_interest_events_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
