ALTER TABLE "item_variations"
ADD COLUMN IF NOT EXISTS "recipe_id" TEXT;

CREATE INDEX IF NOT EXISTS "item_variations_recipe_id_idx"
ON "item_variations" ("recipe_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_variations_recipe_id_fkey'
  ) THEN
    ALTER TABLE "item_variations"
    ADD CONSTRAINT "item_variations_recipe_id_fkey"
    FOREIGN KEY ("recipe_id")
    REFERENCES "recipes"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "ingredient_item_id" TEXT NOT NULL,
  "sort_order_index" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipe_ingredients_recipe_ingredient_unique"
ON "recipe_ingredients" ("recipe_id", "ingredient_item_id");

CREATE INDEX IF NOT EXISTS "recipe_ingredients_recipe_id_idx"
ON "recipe_ingredients" ("recipe_id");

CREATE INDEX IF NOT EXISTS "recipe_ingredients_ingredient_item_id_idx"
ON "recipe_ingredients" ("ingredient_item_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipe_ingredients_recipe_id_fkey'
  ) THEN
    ALTER TABLE "recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey"
    FOREIGN KEY ("recipe_id")
    REFERENCES "recipes"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipe_ingredients_ingredient_item_id_fkey'
  ) THEN
    ALTER TABLE "recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_ingredient_item_id_fkey"
    FOREIGN KEY ("ingredient_item_id")
    REFERENCES "items"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recipe_variation_ingredients" (
  "id" TEXT NOT NULL,
  "recipe_ingredient_id" TEXT NOT NULL,
  "item_variation_id" TEXT NOT NULL,
  "unit" VARCHAR NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_variation_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipe_var_ingredients_recipe_ing_item_var_unique"
ON "recipe_variation_ingredients" ("recipe_ingredient_id", "item_variation_id");

CREATE INDEX IF NOT EXISTS "recipe_var_ingredients_item_variation_id_idx"
ON "recipe_variation_ingredients" ("item_variation_id");

CREATE INDEX IF NOT EXISTS "recipe_var_ingredients_recipe_ingredient_id_idx"
ON "recipe_variation_ingredients" ("recipe_ingredient_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipe_variation_ingredients_recipe_ingredient_id_fkey'
  ) THEN
    ALTER TABLE "recipe_variation_ingredients"
    ADD CONSTRAINT "recipe_variation_ingredients_recipe_ingredient_id_fkey"
    FOREIGN KEY ("recipe_ingredient_id")
    REFERENCES "recipe_ingredients"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipe_variation_ingredients_item_variation_id_fkey'
  ) THEN
    ALTER TABLE "recipe_variation_ingredients"
    ADD CONSTRAINT "recipe_variation_ingredients_item_variation_id_fkey"
    FOREIGN KEY ("item_variation_id")
    REFERENCES "item_variations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill item_variations.recipe_id from recipes(item_id, variation_id)
WITH ranked_recipes AS (
  SELECT
    r.id AS recipe_id,
    r.item_id,
    r.variation_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.item_id, r.variation_id
      ORDER BY r.updated_at DESC, r.created_at DESC, r.id DESC
    ) AS rn
  FROM "recipes" r
  WHERE r.item_id IS NOT NULL
    AND r.variation_id IS NOT NULL
)
UPDATE "item_variations" iv
SET "recipe_id" = rr.recipe_id
FROM ranked_recipes rr
WHERE iv."recipe_id" IS NULL
  AND rr.rn = 1
  AND iv."item_id" = rr.item_id
  AND iv."variation_id" = rr.variation_id;

-- Backfill structural ingredients from legacy recipe_lines
INSERT INTO "recipe_ingredients" (
  "id",
  "recipe_id",
  "ingredient_item_id",
  "sort_order_index",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  rl."recipe_id",
  rl."item_id",
  MIN(COALESCE(rl."sort_order_index", 0))::INTEGER,
  NULLIF(MAX(COALESCE(rl."notes", '')), ''),
  MIN(rl."created_at"),
  MAX(rl."updated_at")
FROM "recipe_lines" rl
GROUP BY rl."recipe_id", rl."item_id"
ON CONFLICT ("recipe_id", "ingredient_item_id") DO UPDATE
SET
  "sort_order_index" = EXCLUDED."sort_order_index",
  "notes" = COALESCE(EXCLUDED."notes", "recipe_ingredients"."notes"),
  "updated_at" = GREATEST("recipe_ingredients"."updated_at", EXCLUDED."updated_at");

-- Backfill per-variation quantities/costs from legacy recipe_lines
WITH line_targets AS (
  SELECT
    rl."id" AS recipe_line_id,
    ri."id" AS recipe_ingredient_id,
    COALESCE(rl."item_variation_id", iv."id") AS item_variation_id,
    rl."unit",
    rl."quantity",
    rl."last_unit_cost_amount",
    rl."avg_unit_cost_amount",
    rl."last_total_cost_amount",
    rl."avg_total_cost_amount",
    rl."created_at",
    rl."updated_at",
    ROW_NUMBER() OVER (
      PARTITION BY ri."id", COALESCE(rl."item_variation_id", iv."id")
      ORDER BY rl."updated_at" DESC, rl."created_at" DESC, rl."id" DESC
    ) AS rn
  FROM "recipe_lines" rl
  INNER JOIN "recipe_ingredients" ri
    ON ri."recipe_id" = rl."recipe_id"
   AND ri."ingredient_item_id" = rl."item_id"
  LEFT JOIN "recipes" r
    ON r."id" = rl."recipe_id"
  LEFT JOIN "item_variations" iv
    ON iv."item_id" = r."item_id"
   AND iv."variation_id" = r."variation_id"
  WHERE COALESCE(rl."item_variation_id", iv."id") IS NOT NULL
)
INSERT INTO "recipe_variation_ingredients" (
  "id",
  "recipe_ingredient_id",
  "item_variation_id",
  "unit",
  "quantity",
  "last_unit_cost_amount",
  "avg_unit_cost_amount",
  "last_total_cost_amount",
  "avg_total_cost_amount",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  lt.recipe_ingredient_id,
  lt.item_variation_id,
  lt."unit",
  lt."quantity",
  lt."last_unit_cost_amount",
  lt."avg_unit_cost_amount",
  lt."last_total_cost_amount",
  lt."avg_total_cost_amount",
  lt."created_at",
  lt."updated_at"
FROM line_targets lt
WHERE lt.rn = 1
ON CONFLICT ("recipe_ingredient_id", "item_variation_id") DO UPDATE
SET
  "unit" = EXCLUDED."unit",
  "quantity" = EXCLUDED."quantity",
  "last_unit_cost_amount" = EXCLUDED."last_unit_cost_amount",
  "avg_unit_cost_amount" = EXCLUDED."avg_unit_cost_amount",
  "last_total_cost_amount" = EXCLUDED."last_total_cost_amount",
  "avg_total_cost_amount" = EXCLUDED."avg_total_cost_amount",
  "updated_at" = GREATEST("recipe_variation_ingredients"."updated_at", EXCLUDED."updated_at");
