-- Drop index on published column
DROP INDEX IF EXISTS "item_selling_prices_published_idx";

-- Drop published and published_at columns from item_selling_prices
ALTER TABLE "item_selling_prices"
  DROP COLUMN IF EXISTS "published",
  DROP COLUMN IF EXISTS "published_at";
