/*
  Warnings:

  - You are about to drop the `menu_item_cost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost" DROP CONSTRAINT "menu_item_cost_menu_item_id_fkey";

-- DropTable
DROP TABLE "menu_item_cost";

-- CreateTable
CREATE TABLE "menu_item_cost_variations" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "label" TEXT NOT NULL,
    "crust_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingredient_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "latestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_cost_variations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
