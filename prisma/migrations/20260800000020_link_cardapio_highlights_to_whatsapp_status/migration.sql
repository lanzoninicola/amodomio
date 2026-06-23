ALTER TABLE "cardapio_highlight_sections"
ADD COLUMN "whatsapp_caption" TEXT;

ALTER TABLE "whatsapp_status_publications"
ADD COLUMN "cardapio_highlight_section_id" TEXT,
ADD COLUMN "source_image_index" INTEGER;

CREATE INDEX "whatsapp_status_publications_highlight_idx"
ON "whatsapp_status_publications"("cardapio_highlight_section_id");

CREATE UNIQUE INDEX "whatsapp_status_publications_highlight_image_key"
ON "whatsapp_status_publications"("cardapio_highlight_section_id", "source_image_index");

ALTER TABLE "whatsapp_status_publications"
ADD CONSTRAINT "whatsapp_status_publications_highlight_fkey"
FOREIGN KEY ("cardapio_highlight_section_id")
REFERENCES "cardapio_highlight_sections"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
