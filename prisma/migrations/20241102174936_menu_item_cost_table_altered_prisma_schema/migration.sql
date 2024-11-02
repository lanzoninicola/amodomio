/*
  Warnings:

  - A unique constraint covering the columns `[menu_item_id]` on the table `menu_item_cost` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cost_id]` on the table `menu_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prev_average_cost` to the `menu_item_cost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prev_latest_cost` to the `menu_item_cost` table without a default value. This is not possible if the table is not empty.
  - Made the column `menu_item_id` on table `menu_item_cost` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "menu_item_cost" DROP CONSTRAINT "menu_item_cost_menu_item_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost" ADD COLUMN     "prev_average_cost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "prev_latest_cost" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "menu_item_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "cost_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_cost_menu_item_id_key" ON "menu_item_cost"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_cost_id_key" ON "menu_items"("cost_id");

-- AddForeignKey
ALTER TABLE "menu_item_cost" ADD CONSTRAINT "menu_item_cost_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
