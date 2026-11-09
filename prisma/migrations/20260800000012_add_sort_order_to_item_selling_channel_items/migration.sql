ALTER TABLE "item_selling_channel_items"
ADD COLUMN "sort_order_index" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "item_selling_channel_items_channel_sort_idx"
ON "item_selling_channel_items"("item_selling_channel_id", "sort_order_index");
