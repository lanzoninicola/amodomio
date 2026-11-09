ALTER TABLE "products" ADD COLUMN "item_id" TEXT;

CREATE INDEX "products_item_id_idx" ON "products"("item_id");

ALTER TABLE "products"
ADD CONSTRAINT "products_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
