-- AlterTable
ALTER TABLE "menu_item_selling_prices_audit" ADD COLUMN     "selling_price_actual_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "selling_price_expected_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
