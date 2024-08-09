/*
  Warnings:

  - You are about to drop the column `url` on the `menu_items_image` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items_image" DROP COLUMN "url",
ADD COLUMN     "secure_url" TEXT;
