/*
  Warnings:

  - You are about to drop the column `name` on the `menu_item_tags` table. All the data in the column will be lost.
  - You are about to drop the column `public` on the `menu_item_tags` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_tags" DROP COLUMN "name",
DROP COLUMN "public";
