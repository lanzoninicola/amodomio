/*
  Warnings:

  - You are about to drop the column `menu_item_size_variation_id` on the `menu_item_cost_variations` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_size_variation_id` on the `menu_item_price_variations` table. All the data in the column will be lost.
  - You are about to drop the `menu_item_size_variations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `menu_item_size_id` to the `menu_item_cost_variations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost_variations" DROP CONSTRAINT "menu_item_cost_variations_menu_item_size_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_price_variations" DROP CONSTRAINT "menu_item_price_variations_menu_item_size_variation_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "menu_item_size_variation_id",
ADD COLUMN     "menu_item_size_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "menu_item_price_variations" DROP COLUMN "menu_item_size_variation_id",
ADD COLUMN     "menu_item_size__id" TEXT;

-- DropTable
DROP TABLE "menu_item_size_variations";

-- CreateTable
CREATE TABLE "menu_item_sizes" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "cost_base" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slug" TEXT,
    "cost_scaling_factor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_sizes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_size__id_fkey" FOREIGN KEY ("menu_item_size__id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
