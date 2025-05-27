/*
  Warnings:

  - You are about to drop the `menu_item_costs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_costs" DROP CONSTRAINT "menu_item_costs_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_costs" DROP CONSTRAINT "menu_item_costs_menu_item_size_id_fkey";

-- DropTable
DROP TABLE "menu_item_costs";

-- CreateTable
CREATE TABLE "menu_item_cost_variations" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "previous_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "menu_item_size_id" TEXT,

    CONSTRAINT "menu_item_cost_variations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_cost_variations_menu_item_id_menu_item_size_id_key" ON "menu_item_cost_variations"("menu_item_id", "menu_item_size_id");

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_cost_variations" ADD CONSTRAINT "menu_item_cost_variations_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
