CREATE TABLE "item_selling_channel_items" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_selling_channel_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_selling_channel_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_selling_channel_items_item_channel_unique"
  ON "item_selling_channel_items"("item_id", "item_selling_channel_id");

CREATE INDEX "item_selling_channel_items_item_id_idx"
  ON "item_selling_channel_items"("item_id");

CREATE INDEX "item_selling_channel_items_channel_id_idx"
  ON "item_selling_channel_items"("item_selling_channel_id");

ALTER TABLE "item_selling_channel_items"
  ADD CONSTRAINT "item_selling_channel_items_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_selling_channel_items"
  ADD CONSTRAINT "item_selling_channel_items_channel_id_fkey"
  FOREIGN KEY ("item_selling_channel_id") REFERENCES "item_selling_channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "item_selling_channel_items" (
  "id",
  "item_id",
  "item_selling_channel_id"
)
SELECT
  gen_random_uuid()::text,
  src.item_id,
  src.item_selling_channel_id
FROM (
  SELECT DISTINCT
    isp.item_id,
    isp.item_selling_channel_id
  FROM "item_selling_prices" isp

  UNION

  SELECT DISTINCT
    mi.item_id,
    isc.id AS item_selling_channel_id
  FROM "menu_item_selling_prices" mispv
  INNER JOIN "menu_items" mi
    ON mi.id = mispv.menu_item_id
  INNER JOIN "menu_item_selling_channels" misc
    ON misc.id = mispv.menu_item_selling_channel_id
  INNER JOIN "item_selling_channels" isc
    ON LOWER(isc."key") = LOWER(misc."key")
  WHERE mi.item_id IS NOT NULL
) src
ON CONFLICT ("item_id", "item_selling_channel_id") DO NOTHING;
