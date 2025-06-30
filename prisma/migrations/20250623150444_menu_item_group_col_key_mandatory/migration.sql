/*
  Warnings:

  - Made the column `key` on table `menu_item_groups` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "menu_item_groups" ALTER COLUMN "key" SET NOT NULL;
