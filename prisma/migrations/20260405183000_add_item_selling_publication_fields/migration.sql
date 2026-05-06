ALTER TABLE "item_selling_info"
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "upcoming" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "item_selling_info_slug_idx"
ON "item_selling_info"("slug");
