-- Nullable snapshot; existing orders and their size counters are preserved.
ALTER TABLE "kds_daily_order_details" ADD COLUMN "order_items" JSONB;
