-- AlterTable
ALTER TABLE "menu_item_selling_channels" ADD COLUMN     "target_margin_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "percentage_tax" SET DEFAULT 0;
