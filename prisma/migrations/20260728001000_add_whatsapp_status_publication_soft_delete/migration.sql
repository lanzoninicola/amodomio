ALTER TABLE "whatsapp_status_publications"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "whatsapp_status_publications_deleted_at_idx"
  ON "whatsapp_status_publications"("deleted_at");
