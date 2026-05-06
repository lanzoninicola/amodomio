CREATE TABLE "item_selling_commercial_info" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "ingredients" TEXT,
  "long_description" TEXT,
  "selling_category_id" TEXT,
  "menu_item_group_id" TEXT,
  "notes_public" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_selling_commercial_info_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_selling_commercial_info_item_id_unique"
ON "item_selling_commercial_info"("item_id");

CREATE INDEX "item_selling_commercial_info_category_id_idx"
ON "item_selling_commercial_info"("selling_category_id");

CREATE INDEX "item_selling_commercial_info_group_id_idx"
ON "item_selling_commercial_info"("menu_item_group_id");

ALTER TABLE "item_selling_commercial_info"
ADD CONSTRAINT "item_selling_commercial_info_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_selling_commercial_info"
ADD CONSTRAINT "item_selling_commercial_info_selling_category_id_fkey"
FOREIGN KEY ("selling_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_selling_commercial_info"
ADD CONSTRAINT "item_selling_commercial_info_menu_item_group_id_fkey"
FOREIGN KEY ("menu_item_group_id") REFERENCES "menu_item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "item_selling_commercial_info" (
  "id",
  "item_id",
  "ingredients",
  "long_description",
  "selling_category_id",
  "menu_item_group_id",
  "notes_public"
)
SELECT
  gen_random_uuid()::text,
  "source"."item_id",
  "source"."ingredients",
  "source"."long_description",
  "source"."category_id",
  "source"."menu_item_group_id",
  "source"."note_public"
FROM (
  SELECT DISTINCT ON ("item_id")
    "item_id",
    "ingredients",
    "long_description",
    "category_id",
    "menu_item_group_id",
    "note_public"
  FROM "menu_items"
  WHERE "deleted_at" IS NULL
    AND "item_id" IS NOT NULL
  ORDER BY "item_id", "sort_order_index" ASC, "name" ASC
) AS "source";
