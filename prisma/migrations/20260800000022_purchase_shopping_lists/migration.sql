CREATE TABLE "purchase_shopping_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_shopping_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchased_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_shopping_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_shopping_lists_status_created_idx"
ON "purchase_shopping_lists"("status", "created_at");

CREATE INDEX "purchase_shopping_list_items_item_idx"
ON "purchase_shopping_list_items"("item_id");

CREATE INDEX "purchase_shopping_list_items_supplier_idx"
ON "purchase_shopping_list_items"("supplier_id");

CREATE UNIQUE INDEX "purchase_shopping_list_items_list_item_unique"
ON "purchase_shopping_list_items"("list_id", "item_id");

ALTER TABLE "purchase_shopping_list_items"
ADD CONSTRAINT "purchase_shopping_list_items_list_id_fkey"
FOREIGN KEY ("list_id") REFERENCES "purchase_shopping_lists"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_shopping_list_items"
ADD CONSTRAINT "purchase_shopping_list_items_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_shopping_list_items"
ADD CONSTRAINT "purchase_shopping_list_items_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
