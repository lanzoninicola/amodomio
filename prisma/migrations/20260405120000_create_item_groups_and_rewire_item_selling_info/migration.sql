CREATE TABLE "item_groups" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sort_order_index" INTEGER NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  "featured" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "item_groups_pkey" PRIMARY KEY ("id")
);

INSERT INTO "item_groups" (
  "id",
  "key",
  "name",
  "description",
  "sort_order_index",
  "visible",
  "created_at",
  "updated_at",
  "deleted_at",
  "deleted_by",
  "featured"
)
SELECT
  "id",
  "key",
  "name",
  "description",
  "sort_order_index",
  "visible",
  "created_at",
  "updated_at",
  "deleted_at",
  "deleted_by",
  "featured"
FROM "menu_item_groups";

ALTER TABLE "item_selling_info"
ADD COLUMN "item_group_id" TEXT;

UPDATE "item_selling_info" AS "isi"
SET "item_group_id" = "mig"."id"
FROM "item_groups" AS "mig"
WHERE "isi"."menu_item_group_id" = "mig"."id";

ALTER TABLE "item_selling_info"
DROP CONSTRAINT IF EXISTS "item_selling_info_menu_item_group_id_fkey";

DROP INDEX IF EXISTS "item_selling_info_group_id_idx";

CREATE INDEX "item_selling_info_group_id_idx"
ON "item_selling_info"("item_group_id");

ALTER TABLE "item_selling_info"
ADD CONSTRAINT "item_selling_info_item_group_id_fkey"
FOREIGN KEY ("item_group_id") REFERENCES "item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_selling_info"
DROP COLUMN "menu_item_group_id";
