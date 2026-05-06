-- Add admin controls for menu item gallery images:
-- slot, visibility, ordering, timestamps and one-primary-per-item enforcement.

ALTER TABLE "menu_item_gallery_images"
ADD COLUMN IF NOT EXISTS "slot" TEXT,
ADD COLUMN IF NOT EXISTS "visible" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "sort_order" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT NOW();

UPDATE "menu_item_gallery_images"
SET "visible" = true
WHERE "visible" IS NULL;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "menu_item_id"
      ORDER BY "isPrimary" DESC, "id" ASC
    ) AS rn
  FROM "menu_item_gallery_images"
)
UPDATE "menu_item_gallery_images" m
SET "sort_order" = ranked.rn
FROM ranked
WHERE m."id" = ranked."id";

-- Keep only one primary per menu item (first by sort_order/id wins).
WITH keepers AS (
  SELECT
    "menu_item_id",
    MIN("id") FILTER (WHERE "isPrimary" = true) AS keep_primary_id
  FROM "menu_item_gallery_images"
  GROUP BY "menu_item_id"
)
UPDATE "menu_item_gallery_images" m
SET "isPrimary" = false
FROM keepers
WHERE m."menu_item_id" = keepers."menu_item_id"
  AND m."isPrimary" = true
  AND m."id" <> keepers.keep_primary_id;

ALTER TABLE "menu_item_gallery_images"
ALTER COLUMN "visible" SET NOT NULL,
ALTER COLUMN "sort_order" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "menu_item_gallery_images_primary_per_item_uq"
ON "menu_item_gallery_images" ("menu_item_id")
WHERE "isPrimary" = true;

CREATE INDEX IF NOT EXISTS "menu_item_gallery_images_menu_item_visible_sort_idx"
ON "menu_item_gallery_images" ("menu_item_id", "visible", "sort_order");
