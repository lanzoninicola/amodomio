ALTER TABLE "variations"
ADD COLUMN "sort_order_index" INTEGER NOT NULL DEFAULT 0;

UPDATE "variations"
SET "sort_order_index" = CASE
  WHEN "kind" = 'size' AND "code" IN ('pizza-medium', 'medio', 'media') THEN 0
  WHEN "kind" = 'size' AND "code" IN ('individual') THEN 1
  WHEN "kind" = 'size' AND "code" IN ('pizza-small', 'pequena', 'small') THEN 2
  WHEN "kind" = 'size' AND "code" IN ('pizza-bigger', 'familia', 'family', 'bigger') THEN 3
  ELSE "sort_order_index"
END;
