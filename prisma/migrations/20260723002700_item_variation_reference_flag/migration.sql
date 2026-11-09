ALTER TABLE "item_variations"
ADD COLUMN "is_reference" BOOLEAN NOT NULL DEFAULT false;

WITH ranked AS (
  SELECT
    iv.id,
    ROW_NUMBER() OVER (
      PARTITION BY iv.item_id
      ORDER BY
        CASE WHEN v.kind = 'base' AND v.code = 'base' THEN 1 ELSE 0 END,
        iv.created_at ASC
    ) AS rn
  FROM "item_variations" iv
  JOIN "variations" v ON v.id = iv.variation_id
  WHERE iv.deleted_at IS NULL
)
UPDATE "item_variations" iv
SET "is_reference" = (ranked.rn = 1),
    "updated_at" = NOW()
FROM ranked
WHERE ranked.id = iv.id;

CREATE UNIQUE INDEX "item_variations_item_id_single_reference_idx"
ON "item_variations" ("item_id")
WHERE "is_reference" = true AND "deleted_at" IS NULL;
