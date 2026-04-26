ALTER TABLE IF EXISTS "recipe_variation_ingredients"
  DROP COLUMN IF EXISTS "last_unit_cost_amount",
  DROP COLUMN IF EXISTS "avg_unit_cost_amount",
  DROP COLUMN IF EXISTS "last_total_cost_amount",
  DROP COLUMN IF EXISTS "avg_total_cost_amount";

ALTER TABLE IF EXISTS "recipe_lines"
  DROP COLUMN IF EXISTS "last_unit_cost_amount",
  DROP COLUMN IF EXISTS "avg_unit_cost_amount",
  DROP COLUMN IF EXISTS "last_total_cost_amount",
  DROP COLUMN IF EXISTS "avg_total_cost_amount";
