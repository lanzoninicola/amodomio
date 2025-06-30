/*
  Warnings:

  - You are about to drop the column `menu_item_costing_variation_id` on the `menu_item_costs` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_cost_amount` on the `menu_item_costs` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `menu_item_selling_prices` table. All the data in the column will be lost.
  - You are about to drop the column `base_price` on the `menu_item_selling_prices` table. All the data in the column will be lost.
  - You are about to drop the column `cost_variation_id` on the `menu_item_selling_prices` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_selling_variation_id` on the `menu_item_selling_prices` table. All the data in the column will be lost.
  - You are about to drop the `menu_item_costing_variations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `menu_item_selling_variations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `price_amount` to the `menu_item_selling_prices` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "menu_item_costs" DROP CONSTRAINT "menu_item_costs_menu_item_costing_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_selling_prices" DROP CONSTRAINT "menu_item_selling_prices_cost_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_selling_prices" DROP CONSTRAINT "menu_item_selling_prices_menu_item_selling_variation_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_costs" DROP COLUMN "menu_item_costing_variation_id",
DROP COLUMN "recipe_cost_amount",
ADD COLUMN     "cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "menu_item_size_id" TEXT;

-- AlterTable
ALTER TABLE "menu_item_selling_prices" DROP COLUMN "amount",
DROP COLUMN "base_price",
DROP COLUMN "cost_variation_id",
DROP COLUMN "menu_item_selling_variation_id",
ADD COLUMN     "menu_item_selling_channel_id" TEXT,
ADD COLUMN     "menu_item_size_id" TEXT,
ADD COLUMN     "price_amount" DOUBLE PRECISION NOT NULL;

-- DropTable
DROP TABLE "menu_item_costing_variations";

-- DropTable
DROP TABLE "menu_item_selling_variations";

-- CreateTable
CREATE TABLE "menu_item_selling_channels" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage_tax" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "menu_item_selling_channels_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices" ADD CONSTRAINT "menu_item_selling_prices_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices" ADD CONSTRAINT "menu_item_selling_prices_menu_item_selling_channel_id_fkey" FOREIGN KEY ("menu_item_selling_channel_id") REFERENCES "menu_item_selling_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_costs" ADD CONSTRAINT "menu_item_costs_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
