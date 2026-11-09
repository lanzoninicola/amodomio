-- AlterTable
ALTER TABLE "item_gallery_images" ADD COLUMN IF NOT EXISTS "variants_json" JSONB;
