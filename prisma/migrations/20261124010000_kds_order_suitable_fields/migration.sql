ALTER TABLE "kds_daily_order_details"
  ADD COLUMN "suitable_order_id" INTEGER,
  ADD COLUMN "delivery_address" TEXT,
  ADD COLUMN "change_for" DECIMAL(10,2),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "paid_online" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "kds_daily_order_details_suitable_order_id_idx" ON "kds_daily_order_details"("suitable_order_id");
