DROP TABLE IF EXISTS "cardapio_highlight_sections" CASCADE;

DROP INDEX IF EXISTS "whatsapp_status_publications_highlight_idx";
DROP INDEX IF EXISTS "whatsapp_status_publications_highlight_image_key";
ALTER TABLE "whatsapp_status_publications"
  DROP COLUMN IF EXISTS "cardapio_highlight_section_id",
  DROP COLUMN IF EXISTS "source_image_index";

CREATE TABLE "content_posts" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "caption" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publish_from" TIMESTAMP(3),
  "publish_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_post_media" (
  "id" TEXT NOT NULL,
  "content_post_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'image',
  "media_url" TEXT NOT NULL,
  "fullscreen_media_url" TEXT,
  "alt" TEXT,
  "link_url" TEXT,
  "link_text" TEXT,
  "link_background_color" TEXT,
  "link_text_color" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "content_post_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_post_media_content_post_id_fkey"
    FOREIGN KEY ("content_post_id")
    REFERENCES "content_posts"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "content_publication_targets" (
  "id" TEXT NOT NULL,
  "content_post_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB,
  "last_published_at" TIMESTAMP(3),
  "removal_requested_at" TIMESTAMP(3),
  "removed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "content_publication_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_publication_targets_content_post_id_fkey"
    FOREIGN KEY ("content_post_id")
    REFERENCES "content_posts"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "content_publication_executions" (
  "id" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL,
  "external_id" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "response" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_publication_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_publication_executions_target_id_fkey"
    FOREIGN KEY ("target_id")
    REFERENCES "content_publication_targets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "content_posts_key_key" ON "content_posts"("key");
CREATE INDEX "content_posts_status_window_idx"
ON "content_posts"("status", "publish_from", "publish_until");
CREATE INDEX "content_posts_deleted_at_idx" ON "content_posts"("deleted_at");

CREATE UNIQUE INDEX "content_post_media_post_key"
ON "content_post_media"("content_post_id", "key");
CREATE INDEX "content_post_media_active_sort_idx"
ON "content_post_media"("content_post_id", "active", "sort_order");

CREATE UNIQUE INDEX "content_publication_targets_post_channel"
ON "content_publication_targets"("content_post_id", "channel");
CREATE INDEX "content_publication_targets_channel_status_idx"
ON "content_publication_targets"("channel", "enabled", "status", "sort_order");
CREATE INDEX "content_publication_targets_deleted_at_idx"
ON "content_publication_targets"("deleted_at");

CREATE INDEX "content_publication_executions_target_started_idx"
ON "content_publication_executions"("target_id", "started_at");
CREATE INDEX "content_publication_executions_status_idx"
ON "content_publication_executions"("status");

DELETE FROM "whatsapp_status_publications"
WHERE "source_type" = 'cardapio-highlight';

DELETE FROM "instagram_story_publications"
WHERE "source_type" = 'cardapio-highlight';
