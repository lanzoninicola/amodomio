-- AlterTable
ALTER TABLE "mogo_orders_inbound" ALTER COLUMN "order_date_str" DROP NOT NULL,
ALTER COLUMN "order_time_str" DROP NOT NULL;
