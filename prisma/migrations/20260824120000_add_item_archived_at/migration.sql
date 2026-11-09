ALTER TABLE "items"
ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "items_archived_at_idx" ON "items"("archived_at");
