/*
  Warnings:

  - You are about to drop the column `image_file_name` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `menu_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "image_file_name",
DROP COLUMN "image_url",
ADD COLUMN     "image_id" TEXT;

-- CreateTable
CREATE TABLE "menu_items_image" (
    "id" TEXT NOT NULL,
    "url" TEXT,
    "asset_folder" TEXT,
    "original_file_name" TEXT,
    "display_name" TEXT,
    "height" TEXT,
    "width" TEXT,
    "thumbnail_url" TEXT,
    "format" TEXT,

    CONSTRAINT "menu_items_image_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "menu_items_image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
