-- CreateTable
CREATE TABLE "menu_item_gallery_images" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "secure_url" TEXT,
    "asset_folder" TEXT,
    "original_file_name" TEXT,
    "display_name" TEXT,
    "height" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "thumbnail_url" TEXT,
    "format" TEXT,
    "public_id" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "menu_item_gallery_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_gallery_images" ADD CONSTRAINT "menu_item_gallery_images_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
