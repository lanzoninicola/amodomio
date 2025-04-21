/*
  Warnings:

  - Made the column `key` on table `menu_item_selling_variations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "menu_item_selling_variations" ALTER COLUMN "key" SET NOT NULL;
