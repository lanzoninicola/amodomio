-- AlterTable
ALTER TABLE "kds_daily_orders" ADD COLUMN     "is_open" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opened_at" TIMESTAMP(3);
