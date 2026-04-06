CREATE TABLE "item_gallery_images" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'image',
  "secure_url" TEXT,
  "slot" TEXT,
  "asset_id" TEXT,
  "media_asset_id" UUID,
  "asset_folder" TEXT,
  "original_file_name" TEXT,
  "display_name" TEXT,
  "height" DOUBLE PRECISION,
  "width" DOUBLE PRECISION,
  "thumbnail_url" TEXT,
  "format" TEXT,
  "public_id" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_gallery_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_gallery_images_item_id_idx"
ON "item_gallery_images"("item_id");

CREATE INDEX "item_gallery_images_item_primary_idx"
ON "item_gallery_images"("item_id", "is_primary");

ALTER TABLE "item_gallery_images"
ADD CONSTRAINT "item_gallery_images_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_gallery_images"
ADD CONSTRAINT "item_gallery_images_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
