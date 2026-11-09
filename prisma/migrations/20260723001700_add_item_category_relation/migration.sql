ALTER TABLE "items"
ADD COLUMN IF NOT EXISTS "category_id" TEXT;

CREATE INDEX IF NOT EXISTS "items_category_id_idx" ON "items"("category_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_category_id_fkey'
  ) THEN
    ALTER TABLE "items"
    ADD CONSTRAINT "items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
