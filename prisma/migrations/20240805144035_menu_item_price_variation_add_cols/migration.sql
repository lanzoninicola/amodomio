-- AlterTable
ALTER TABLE "menu_item_price_variations" ADD COLUMN     "latestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" TEXT;
