UPDATE "content_publication_targets" AS target
SET "config" = COALESCE(target."config", '{}'::jsonb) || jsonb_build_object(
  'selectedMediaKeys',
  COALESCE(
    (
      SELECT jsonb_agg(media."key" ORDER BY media."sort_order", media."created_at")
      FROM "content_post_media" AS media
      WHERE media."content_post_id" = target."content_post_id"
        AND media."active" = true
        AND media."deleted_at" IS NULL
        AND media."kind" IN ('image', 'video')
    ),
    '[]'::jsonb
  ),
  'mediaConfigByKey',
  COALESCE(
    (
      SELECT jsonb_object_agg(
        media."key",
        jsonb_build_object(
          'linkUrl', media."link_url",
          'linkText', media."link_text",
          'linkMenuItemId', media."link_menu_item_id",
          'linkBackgroundColor', media."link_background_color",
          'linkTextColor', media."link_text_color",
          'linkPosition', media."link_position",
          'linkNewTab', media."link_new_tab",
          'chipAction', media."chip_action",
          'chipModalTitle', media."chip_modal_title",
          'chipModalBody', media."chip_modal_body"
        )
      )
      FROM "content_post_media" AS media
      WHERE media."content_post_id" = target."content_post_id"
        AND media."deleted_at" IS NULL
    ),
    '{}'::jsonb
  )
)
WHERE target."channel" = 'cardapio-featured'
  AND target."deleted_at" IS NULL
  AND (
    NOT (COALESCE(target."config", '{}'::jsonb) ? 'selectedMediaKeys')
    OR NOT (COALESCE(target."config", '{}'::jsonb) ? 'mediaConfigByKey')
  );
