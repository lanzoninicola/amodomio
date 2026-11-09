DROP INDEX IF EXISTS "content_publication_targets_channel_status_idx";

ALTER TABLE "content_publication_targets"
  DROP COLUMN IF EXISTS "enabled";

CREATE INDEX "content_publication_targets_channel_status_idx"
ON "content_publication_targets"("channel", "status", "sort_order");
