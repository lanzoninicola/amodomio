-- CreateTable
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'csv',
    "order_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone_raw" TEXT,
    "phone_e164" TEXT,
    "payment_type" TEXT NOT NULL,
    "paid_at_date" TEXT NOT NULL,
    "paid_at_hour" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "table_label" TEXT,
    "order_tag" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2) NOT NULL,
    "is_fee" BOOLEAN NOT NULL DEFAULT false,
    "is_discount" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_orders_paid_at_idx" ON "customer_orders"("paid_at");

-- CreateIndex
CREATE INDEX "customer_orders_phone_e164_idx" ON "customer_orders"("phone_e164");

-- CreateIndex
CREATE INDEX "customer_orders_order_number_idx" ON "customer_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_source_order_number_paid_at_date_paid_at_ho_key" ON "customer_orders"("source", "order_number", "paid_at_date", "paid_at_hour");

-- CreateIndex
CREATE INDEX "customer_order_items_order_id_idx" ON "customer_order_items"("order_id");

-- CreateIndex
CREATE INDEX "customer_order_items_product_name_idx" ON "customer_order_items"("product_name");

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
