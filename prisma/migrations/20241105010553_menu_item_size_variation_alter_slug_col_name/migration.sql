/*
  Warnings:

  - You are about to drop the column `size_slug` on the `menu_item_size_variations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_size_variations" DROP COLUMN "size_slug",
ADD COLUMN     "slug" TEXT;
