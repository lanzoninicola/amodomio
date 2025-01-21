/*
  Warnings:

  - Made the column `name` on table `menu_item_sizes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `slug` on table `menu_item_sizes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "menu_item_sizes" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL;
