ALTER TABLE "recipe_sheets" ADD COLUMN "item_id" TEXT;

CREATE INDEX "recipe_sheets_item_id_idx" ON "recipe_sheets"("item_id");

ALTER TABLE "recipe_sheets"
ADD CONSTRAINT "recipe_sheets_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "recipe_sheets" rs
SET "item_id" = mi."item_id"
FROM "menu_items" mi
WHERE rs."menu_item_id" = mi."id"
  AND mi."item_id" IS NOT NULL
  AND rs."item_id" IS NULL;
