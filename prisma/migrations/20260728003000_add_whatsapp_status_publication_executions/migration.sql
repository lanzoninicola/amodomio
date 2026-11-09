CREATE TABLE IF NOT EXISTS "whatsapp_status_publication_executions" (
  "id" TEXT NOT NULL,
  "publication_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'api',
  "schedule_name" TEXT,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "response" JSONB,
  "error" TEXT,
  "request_body" JSONB,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_status_publication_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_status_publication_executions_publication_id_fkey"
    FOREIGN KEY ("publication_id")
    REFERENCES "whatsapp_status_publications"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "whatsapp_status_publication_executions_publication_started_idx"
  ON "whatsapp_status_publication_executions"("publication_id", "started_at");

CREATE INDEX IF NOT EXISTS "whatsapp_status_publication_executions_source_idx"
  ON "whatsapp_status_publication_executions"("source");

CREATE INDEX IF NOT EXISTS "whatsapp_status_publication_executions_status_idx"
  ON "whatsapp_status_publication_executions"("status");
