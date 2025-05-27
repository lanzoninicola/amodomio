-- AlterTable
ALTER TABLE "menu_item_selling_prices" ADD COLUMN     "price_expected_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "profit_actual_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "profit_expected_perc" DOUBLE PRECISION NOT NULL DEFAULT 0;
