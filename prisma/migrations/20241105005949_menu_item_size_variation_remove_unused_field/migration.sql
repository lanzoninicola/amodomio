/*
  Warnings:

  - You are about to drop the column `label` on the `menu_item_size_variations` table. All the data in the column will be lost.
  - Made the column `size_slug` on table `menu_item_size_variations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "menu_item_size_variations" DROP COLUMN "label",
ALTER COLUMN "size_slug" SET NOT NULL;
