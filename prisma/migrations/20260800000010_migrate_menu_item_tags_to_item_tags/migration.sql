WITH ranked_legacy AS (
  SELECT
    mit.id,
    mi.item_id,
    mit.tag_id,
    mit.deleted_at,
    mit.created_at,
    mit.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY mi.item_id, mit.tag_id
      ORDER BY
        CASE WHEN mit.deleted_at IS NULL THEN 0 ELSE 1 END ASC,
        COALESCE(mit.updated_at, mit.created_at) DESC,
        mit.created_at DESC,
        mit.id ASC
    ) AS row_rank
  FROM menu_item_tags mit
  JOIN menu_items mi
    ON mi.id = mit.menu_item_id
  WHERE mi.item_id IS NOT NULL
    AND mit.tag_id IS NOT NULL
),
canonical_legacy AS (
  SELECT
    id,
    item_id,
    tag_id,
    deleted_at,
    created_at,
    updated_at
  FROM ranked_legacy
  WHERE row_rank = 1
)
UPDATE item_tags it
SET
  id = CASE
    WHEN it.id = cl.id THEN it.id
    WHEN EXISTS (
      SELECT 1
      FROM item_tags conflict
      WHERE conflict.id = cl.id
    ) THEN it.id
    ELSE cl.id
  END,
  deleted_at = cl.deleted_at,
  created_at = cl.created_at,
  updated_at = GREATEST(it.updated_at, cl.updated_at)
FROM canonical_legacy cl
WHERE it.item_id = cl.item_id
  AND it.tag_id = cl.tag_id;

WITH ranked_legacy AS (
  SELECT
    mit.id,
    mi.item_id,
    mit.tag_id,
    mit.deleted_at,
    mit.created_at,
    mit.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY mi.item_id, mit.tag_id
      ORDER BY
        CASE WHEN mit.deleted_at IS NULL THEN 0 ELSE 1 END ASC,
        COALESCE(mit.updated_at, mit.created_at) DESC,
        mit.created_at DESC,
        mit.id ASC
    ) AS row_rank
  FROM menu_item_tags mit
  JOIN menu_items mi
    ON mi.id = mit.menu_item_id
  WHERE mi.item_id IS NOT NULL
    AND mit.tag_id IS NOT NULL
),
canonical_legacy AS (
  SELECT
    id,
    item_id,
    tag_id,
    deleted_at,
    created_at,
    updated_at
  FROM ranked_legacy
  WHERE row_rank = 1
)
INSERT INTO item_tags (
  id,
  item_id,
  tag_id,
  deleted_at,
  created_at,
  updated_at
)
SELECT
  cl.id,
  cl.item_id,
  cl.tag_id,
  cl.deleted_at,
  cl.created_at,
  cl.updated_at
FROM canonical_legacy cl
WHERE NOT EXISTS (
  SELECT 1
  FROM item_tags it
  WHERE it.item_id = cl.item_id
    AND it.tag_id = cl.tag_id
)
  AND NOT EXISTS (
    SELECT 1
    FROM item_tags conflict
    WHERE conflict.id = cl.id
  );
