ALTER TABLE "menu_item_gallery_images"
ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'image',
ADD COLUMN IF NOT EXISTS "media_asset_id" UUID;

UPDATE "menu_item_gallery_images"
SET "kind" = 'image'
WHERE "kind" IS NULL OR btrim("kind") = '';

-- Best-effort backfill relation by URL match (latest asset wins).
WITH ranked_assets AS (
  SELECT
    ma.id,
    ma.url,
    ROW_NUMBER() OVER (PARTITION BY ma.url ORDER BY ma.created_at DESC) AS rn
  FROM "media_assets" ma
)
UPDATE "menu_item_gallery_images" mig
SET "media_asset_id" = ra.id
FROM ranked_assets ra
WHERE mig."media_asset_id" IS NULL
  AND mig."secure_url" IS NOT NULL
  AND mig."secure_url" = ra.url
  AND ra.rn = 1;

CREATE INDEX IF NOT EXISTS "menu_item_gallery_images_media_asset_id_idx"
  ON "menu_item_gallery_images" ("media_asset_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'menu_item_gallery_images_media_asset_id_fkey'
  ) THEN
    ALTER TABLE "menu_item_gallery_images"
    ADD CONSTRAINT "menu_item_gallery_images_media_asset_id_fkey"
    FOREIGN KEY ("media_asset_id")
    REFERENCES "media_assets"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
