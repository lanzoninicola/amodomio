CREATE TABLE "items" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "classification" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "can_purchase" BOOLEAN NOT NULL DEFAULT false,
  "can_transform" BOOLEAN NOT NULL DEFAULT false,
  "can_sell" BOOLEAN NOT NULL DEFAULT false,
  "can_stock" BOOLEAN NOT NULL DEFAULT false,
  "can_be_in_menu" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "items_classification_idx" ON "items"("classification");
CREATE INDEX "items_active_classification_idx" ON "items"("active", "classification");

ALTER TABLE "menu_items" ADD COLUMN "item_id" TEXT;
CREATE INDEX "menu_items_item_id_idx" ON "menu_items"("item_id");

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
