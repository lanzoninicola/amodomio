CREATE TABLE "supplier_purchase_orders" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_purchase_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_purchase_orders_supplier_created_idx" ON "supplier_purchase_orders"("supplier_id", "created_at");
CREATE INDEX "supplier_purchase_orders_status_created_idx" ON "supplier_purchase_orders"("status", "created_at");
CREATE UNIQUE INDEX "supplier_purchase_order_items_order_item_unique" ON "supplier_purchase_order_items"("order_id", "item_id");
CREATE INDEX "supplier_purchase_order_items_item_idx" ON "supplier_purchase_order_items"("item_id");

ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supplier_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
