/*
  Warnings:

  - You are about to drop the column `amount` on the `menu_item_cost_variations` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_id` on the `menu_item_size_variations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_size_variations" DROP CONSTRAINT "menu_item_size_variations_menu_item_id_fkey";

-- AlterTable
ALTER TABLE "menu_item_cost_variations" DROP COLUMN "amount";

-- AlterTable
ALTER TABLE "menu_item_size_variations" DROP COLUMN "menu_item_id";
