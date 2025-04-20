/*
  Warnings:

  - You are about to drop the column `menu_item_size_id` on the `menu_item_cost_variations` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_size_id` on the `menu_item_price_variations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost_variations" DROP CONSTRAINT "menu_item_cost_variations_menu_item_size_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_price_variations" DROP CONSTRAINT "menu_item_price_variations_menu_item_size_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "menu_item_size_id",
ADD COLUMN     "menu_item_variation_id" TEXT;

-- AlterTable
ALTER TABLE "menu_item_price_variations" DROP COLUMN "menu_item_size_id",
ADD COLUMN     "menu_item_variation_id" TEXT;

-- CreateTable
CREATE TABLE "menu_item_variations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_variations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_variation_id_fkey" FOREIGN KEY ("menu_item_variation_id") REFERENCES "menu_item_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_variation_id_fkey" FOREIGN KEY ("menu_item_variation_id") REFERENCES "menu_item_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
