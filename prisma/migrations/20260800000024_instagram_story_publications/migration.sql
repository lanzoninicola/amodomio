CREATE TABLE "instagram_story_publications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "source_type" TEXT,
  "source_id" TEXT,
  "source_item_key" TEXT,
  "last_container_id" TEXT,
  "last_instagram_media_id" TEXT,
  "last_published_at" TIMESTAMP(3),
  "last_publish_status" TEXT,
  "last_publish_response" JSONB,
  "last_publish_error" TEXT,
  "deactivated_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "instagram_story_publications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instagram_story_publication_executions" (
  "id" TEXT NOT NULL,
  "publication_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'api',
  "schedule_name" TEXT,
  "status" TEXT NOT NULL,
  "container_id" TEXT,
  "instagram_media_id" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "response" JSONB,
  "error" TEXT,
  "request_body" JSONB,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "instagram_story_publication_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "instagram_story_publication_executions_publication_id_fkey"
    FOREIGN KEY ("publication_id")
    REFERENCES "instagram_story_publications"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "instagram_story_publications_source_item_key"
ON "instagram_story_publications"("source_type", "source_id", "source_item_key");

CREATE INDEX "instagram_story_publications_active_updated_idx"
ON "instagram_story_publications"("active", "updated_at");

CREATE INDEX "instagram_story_publications_source_idx"
ON "instagram_story_publications"("source_type", "source_id");

CREATE INDEX "instagram_story_publications_status_idx"
ON "instagram_story_publications"("last_publish_status");

CREATE INDEX "instagram_story_executions_publication_started_idx"
ON "instagram_story_publication_executions"("publication_id", "started_at");

CREATE INDEX "instagram_story_executions_source_idx"
ON "instagram_story_publication_executions"("source");

CREATE INDEX "instagram_story_executions_status_idx"
ON "instagram_story_publication_executions"("status");
