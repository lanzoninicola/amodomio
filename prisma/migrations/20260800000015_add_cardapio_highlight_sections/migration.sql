CREATE TABLE "cardapio_highlight_sections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "image_items_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cardapio_highlight_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cardapio_highlight_sections_key_key" ON "cardapio_highlight_sections"("key");
CREATE INDEX "cardapio_highlight_sections_published_sort_idx" ON "cardapio_highlight_sections"("published", "sort_order");
CREATE INDEX "cardapio_highlight_sections_deleted_at_idx" ON "cardapio_highlight_sections"("deleted_at");
