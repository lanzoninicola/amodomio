WITH ranked_legacy AS (
  SELECT
    mi.item_id,
    mig.kind,
    mig.secure_url,
    mig.slot,
    mig.asset_id,
    mig.media_asset_id,
    mig.asset_folder,
    mig.original_file_name,
    mig.display_name,
    mig.height,
    mig.width,
    mig.thumbnail_url,
    mig.format,
    mig.public_id,
    mig.visible,
    mig.sort_order,
    mig.created_at,
    mig.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY mi.item_id
      ORDER BY mig."isPrimary" DESC, mig.sort_order ASC, mig.created_at ASC, mig.id ASC
    ) AS asset_rank
  FROM menu_item_gallery_images mig
  JOIN menu_items mi
    ON mi.id = mig.menu_item_id
  WHERE mi.item_id IS NOT NULL
),
normalized_legacy AS (
  SELECT
    item_id,
    kind,
    secure_url,
    CASE
      WHEN asset_rank = 1 THEN 'cover'
      ELSE COALESCE(NULLIF(slot, ''), 'gallery')
    END AS slot,
    asset_id,
    media_asset_id,
    asset_folder,
    original_file_name,
    display_name,
    height,
    width,
    thumbnail_url,
    format,
    public_id,
    asset_rank = 1 AS is_primary,
    visible,
    sort_order,
    created_at,
    updated_at
  FROM ranked_legacy
)
INSERT INTO item_gallery_images (
  id,
  item_id,
  kind,
  secure_url,
  slot,
  asset_id,
  media_asset_id,
  asset_folder,
  original_file_name,
  display_name,
  height,
  width,
  thumbnail_url,
  format,
  public_id,
  is_primary,
  visible,
  sort_order,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  nl.item_id,
  nl.kind,
  nl.secure_url,
  nl.slot,
  nl.asset_id,
  nl.media_asset_id,
  nl.asset_folder,
  nl.original_file_name,
  nl.display_name,
  nl.height,
  nl.width,
  nl.thumbnail_url,
  nl.format,
  nl.public_id,
  nl.is_primary,
  nl.visible,
  nl.sort_order,
  nl.created_at,
  nl.updated_at
FROM normalized_legacy nl
WHERE NOT EXISTS (
  SELECT 1
  FROM item_gallery_images ig
  WHERE ig.item_id = nl.item_id
    AND COALESCE(ig.secure_url, '') = COALESCE(nl.secure_url, '')
    AND COALESCE(ig.kind, '') = COALESCE(nl.kind, '')
    AND COALESCE(ig.sort_order, 0) = COALESCE(nl.sort_order, 0)
);
