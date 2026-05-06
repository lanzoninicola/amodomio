CREATE TABLE "item_tags" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_tags_item_tag_unique"
ON "item_tags"("item_id", "tag_id");

CREATE INDEX "item_tags_item_id_idx"
ON "item_tags"("item_id");

CREATE INDEX "item_tags_tag_id_idx"
ON "item_tags"("tag_id");

ALTER TABLE "item_tags"
ADD CONSTRAINT "item_tags_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_tags"
ADD CONSTRAINT "item_tags_tag_id_fkey"
FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
