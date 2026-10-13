ALTER TABLE "customer_orders" ADD COLUMN "customer_id" TEXT, ADD COLUMN "kds_order_id" TEXT;
ALTER TABLE "customer_order_items" ADD COLUMN "size" TEXT, ADD COLUMN "flavors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "notes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "customer_orders_kds_order_id_key" ON "customer_orders"("kds_order_id");
CREATE INDEX "customer_orders_customer_id_paid_at_idx" ON "customer_orders"("customer_id", "paid_at");
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_kds_order_id_fkey" FOREIGN KEY ("kds_order_id") REFERENCES "kds_daily_order_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "customer_orders" o SET "customer_id" = c."id" FROM "crm_customer" c WHERE o."phone_e164" = c."phone_e164";
ALTER TABLE "customer_order_items" ALTER COLUMN "amount" DROP NOT NULL;
