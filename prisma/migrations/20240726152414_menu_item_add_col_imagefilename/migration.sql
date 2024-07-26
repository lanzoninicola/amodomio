/*
  Warnings:

  - You are about to drop the column `imageBase64` on the `menu_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "imageBase64",
ADD COLUMN     "image_base64" TEXT,
ADD COLUMN     "image_file_name" TEXT;
