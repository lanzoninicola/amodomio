ALTER TABLE "kds_daily_order_details"
ADD COLUMN "is_cash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_other_payment_method" BOOLEAN NOT NULL DEFAULT false;
