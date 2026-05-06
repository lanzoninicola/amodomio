ALTER TABLE "recipes"
ADD COLUMN "variation_id" TEXT;

CREATE INDEX "recipes_variation_id_idx" ON "recipes"("variation_id");

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_variation_id_fkey"
FOREIGN KEY ("variation_id") REFERENCES "variations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "recipe_lines" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_variation_id" TEXT,
  "unit" VARCHAR NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sort_order_index" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_lines_recipe_id_idx" ON "recipe_lines"("recipe_id");
CREATE INDEX "recipe_lines_item_id_idx" ON "recipe_lines"("item_id");
CREATE INDEX "recipe_lines_item_variation_id_idx" ON "recipe_lines"("item_variation_id");

ALTER TABLE "recipe_lines"
ADD CONSTRAINT "recipe_lines_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_lines"
ADD CONSTRAINT "recipe_lines_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_lines"
ADD CONSTRAINT "recipe_lines_item_variation_id_fkey"
FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
