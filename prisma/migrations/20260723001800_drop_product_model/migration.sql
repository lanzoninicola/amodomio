-- Remove legacy Product model and related links.
-- Note: recipe_sheet_lines.type='product' is remapped to 'manual' before enum rewrite.

-- 1) Migrate recipe sheet lines away from deprecated enum value.
UPDATE "recipe_sheet_lines"
SET "type" = 'manual'
WHERE "type" = 'product';

ALTER TABLE "recipe_sheet_lines"
ALTER COLUMN "type" DROP DEFAULT;

CREATE TYPE "RecipeSheetLineType_new" AS ENUM ('recipe', 'recipeSheet', 'manual', 'labor');

ALTER TABLE "recipe_sheet_lines"
ALTER COLUMN "type" TYPE "RecipeSheetLineType_new"
USING (
  CASE
    WHEN "type"::text = 'product' THEN 'manual'
    ELSE "type"::text
  END
)::"RecipeSheetLineType_new";

DROP TYPE "RecipeSheetLineType";
ALTER TYPE "RecipeSheetLineType_new" RENAME TO "RecipeSheetLineType";

ALTER TABLE "recipe_sheet_lines"
ALTER COLUMN "type" SET DEFAULT 'manual';

-- 2) Remove recipe ingredient links to products.
ALTER TABLE "recipes_ingredients_links"
DROP CONSTRAINT IF EXISTS "recipes_ingredients_links_productId_fkey";

ALTER TABLE "recipes_ingredients_links"
DROP COLUMN IF EXISTS "productId";

-- 3) Remove product measurement table first (depends on products).
DROP TABLE IF EXISTS "product_measurements";

-- 4) Remove legacy products table.
DROP TABLE IF EXISTS "products";
