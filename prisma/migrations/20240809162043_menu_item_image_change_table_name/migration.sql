/*
  Warnings:

  - You are about to drop the `menu_items_images` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_image_id_fkey";

-- DropTable
DROP TABLE "menu_items_images";

-- CreateTable
CREATE TABLE "menu_items_image" (
    "id" TEXT NOT NULL,
    "secure_url" TEXT,
    "asset_folder" TEXT,
    "original_file_name" TEXT,
    "display_name" TEXT,
    "height" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "thumbnail_url" TEXT,
    "format" TEXT,
    "public_id" TEXT,

    CONSTRAINT "menu_items_image_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "menu_items_image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
