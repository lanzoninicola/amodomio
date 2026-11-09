ALTER TABLE "recipe_ingredients"
  ADD COLUMN IF NOT EXISTS "default_loss_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "recipe_variation_ingredients"
  ADD COLUMN IF NOT EXISTS "loss_pct" DOUBLE PRECISION;
