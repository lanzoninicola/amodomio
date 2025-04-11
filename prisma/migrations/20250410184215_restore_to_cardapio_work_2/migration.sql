/*
  Warnings:

  - Added the required column `label` to the `menu_item_price_variations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item_price_variations" ADD COLUMN     "label" TEXT NOT NULL;
