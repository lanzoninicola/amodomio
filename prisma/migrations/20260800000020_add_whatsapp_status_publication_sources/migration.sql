ALTER TABLE "whatsapp_status_publications"
ADD COLUMN "source_type" TEXT,
ADD COLUMN "source_id" TEXT,
ADD COLUMN "source_item_key" TEXT;

CREATE INDEX "whatsapp_status_publications_source_idx"
ON "whatsapp_status_publications"("source_type", "source_id");

CREATE UNIQUE INDEX "whatsapp_status_publications_source_item_key"
ON "whatsapp_status_publications"("source_type", "source_id", "source_item_key");
