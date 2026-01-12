-- AlterTable
ALTER TABLE "menu_item_sizes" ADD COLUMN     "max_serve_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "max_serve_amount_description" TEXT,
ADD COLUMN     "max_toppings_amount_description" TEXT,
ADD COLUMN     "name_short" TEXT;
