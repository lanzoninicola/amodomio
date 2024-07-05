/*
  Warnings:

  - You are about to drop the column `menu_index` on the `menu_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "menu_index",
ADD COLUMN     "sort_order_index" INTEGER NOT NULL DEFAULT 0;
