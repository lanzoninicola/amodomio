CREATE TABLE "whatsapp_status_publications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT,
  "video_url" TEXT,
  "caption" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "last_published_at" TIMESTAMP(3),
  "last_publish_status" TEXT,
  "last_publish_response" JSONB,
  "last_publish_error" TEXT,
  "deactivated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_status_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_status_publications_active_updated_idx"
  ON "whatsapp_status_publications"("active", "updated_at");

CREATE INDEX "whatsapp_status_publications_kind_idx"
  ON "whatsapp_status_publications"("kind");
