-- Ensure item_variations are linked to recipes using item/variation pair
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
WHERE rr.rn = 1
  AND iv."item_id" = rr.item_id
  AND iv."variation_id" = rr.variation_id
  AND iv."recipe_id" IS NULL;

-- Backfill per-variation rows from structural ingredients + legacy recipe_lines snapshots.
WITH line_latest AS (
  SELECT
    rl."recipe_id",
    rl."item_id",
    rl."unit",
    rl."quantity",
    rl."last_unit_cost_amount",
    rl."avg_unit_cost_amount",
    rl."last_total_cost_amount",
    rl."avg_total_cost_amount",
    rl."created_at",
    rl."updated_at",
    ROW_NUMBER() OVER (
      PARTITION BY rl."recipe_id", rl."item_id"
      ORDER BY rl."updated_at" DESC, rl."created_at" DESC, rl."id" DESC
    ) AS rn
  FROM "recipe_lines" rl
),
ins AS (
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
    ri."id",
    iv."id",
    COALESCE(ll."unit", 'UN'),
    COALESCE(ll."quantity", 0),
    COALESCE(ll."last_unit_cost_amount", 0),
    COALESCE(ll."avg_unit_cost_amount", 0),
    COALESCE(ll."last_total_cost_amount", 0),
    COALESCE(ll."avg_total_cost_amount", 0),
    COALESCE(ll."created_at", NOW()),
    COALESCE(ll."updated_at", NOW())
  FROM "recipe_ingredients" ri
  INNER JOIN "item_variations" iv
    ON iv."recipe_id" = ri."recipe_id"
   AND iv."deleted_at" IS NULL
  LEFT JOIN line_latest ll
    ON ll."recipe_id" = ri."recipe_id"
   AND ll."item_id" = ri."ingredient_item_id"
   AND ll."rn" = 1
  ON CONFLICT ("recipe_ingredient_id", "item_variation_id") DO NOTHING
  RETURNING "id"
)
SELECT COUNT(*) AS inserted_rows FROM ins;
