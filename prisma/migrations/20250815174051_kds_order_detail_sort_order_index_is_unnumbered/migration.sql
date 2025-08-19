-- AlterTable
ALTER TABLE "kds_daily_order_details" ADD COLUMN     "is_unnumbered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort_order_index" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "kds_daily_order_details_date_int_sort_order_index_idx" ON "kds_daily_order_details"("date_int", "sort_order_index");
