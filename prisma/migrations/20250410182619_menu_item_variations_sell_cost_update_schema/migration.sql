/*
  Warnings:

  - You are about to drop the `menu_item_cost_variations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `menu_item_price_variations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `menu_item_variations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost_variations" DROP CONSTRAINT "menu_item_cost_variations_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_cost_variations" DROP CONSTRAINT "menu_item_cost_variations_menu_item_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_price_variations" DROP CONSTRAINT "menu_item_price_variations_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_price_variations" DROP CONSTRAINT "menu_item_price_variations_menu_item_variation_id_fkey";

-- DropTable
DROP TABLE "menu_item_cost_variations";

-- DropTable
DROP TABLE "menu_item_price_variations";

-- DropTable
DROP TABLE "menu_item_variations";

-- CreateTable
CREATE TABLE "menu_item_selling_variations" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_selling_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_selling_prices" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "menu_item_selling_variation_id" TEXT,
    "base_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "discount_percentage" DOUBLE PRECISION NOT NULL,
    "show_on_cardapio" BOOLEAN NOT NULL DEFAULT false,
    "show_on_cardapio_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "latestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_selling_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_costing_variations" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_costing_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_costs" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "menu_item_costing_variation_id" TEXT,
    "recipe_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "menu_item_costs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices" ADD CONSTRAINT "menu_item_selling_prices_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices" ADD CONSTRAINT "menu_item_selling_prices_menu_item_selling_variation_id_fkey" FOREIGN KEY ("menu_item_selling_variation_id") REFERENCES "menu_item_selling_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_costs" ADD CONSTRAINT "menu_item_costs_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_costs" ADD CONSTRAINT "menu_item_costs_menu_item_costing_variation_id_fkey" FOREIGN KEY ("menu_item_costing_variation_id") REFERENCES "menu_item_costing_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
