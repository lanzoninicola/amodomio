/*
  Warnings:

  - You are about to drop the column `image_base64` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_base64_icon` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_base64_thumb` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_file_name_icon` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_file_name_thumb` on the `menu_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "image_base64",
DROP COLUMN "image_base64_icon",
DROP COLUMN "image_base64_thumb",
DROP COLUMN "image_file_name_icon",
DROP COLUMN "image_file_name_thumb";
