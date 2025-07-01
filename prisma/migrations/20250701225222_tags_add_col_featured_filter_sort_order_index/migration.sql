-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "featured_filter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort_order_index" INTEGER NOT NULL DEFAULT 0;
