ALTER TABLE "recipes" ADD COLUMN "item_id" TEXT;

CREATE INDEX "recipes_item_id_idx" ON "recipes"("item_id");

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
