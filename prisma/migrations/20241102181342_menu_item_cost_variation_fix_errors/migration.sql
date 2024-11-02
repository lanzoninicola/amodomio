/*
  Warnings:

  - You are about to drop the column `cost_id` on the `menu_items` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "menu_items_cost_id_key";

-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "cost_id";
