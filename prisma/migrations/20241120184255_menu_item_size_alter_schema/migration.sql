-- AlterTable
ALTER TABLE "menu_item_sizes" ADD COLUMN     "group" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sort_order_index" INTEGER NOT NULL DEFAULT 0;
