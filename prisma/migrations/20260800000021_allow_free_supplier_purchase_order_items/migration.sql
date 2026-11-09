ALTER TABLE "supplier_purchase_order_items"
ALTER COLUMN "item_id" DROP NOT NULL,
ADD COLUMN "free_item_name" TEXT;

ALTER TABLE "supplier_purchase_order_items"
ADD CONSTRAINT "supplier_purchase_order_items_name_check"
CHECK (
  "item_id" IS NOT NULL
  OR NULLIF(BTRIM("free_item_name"), '') IS NOT NULL
);
