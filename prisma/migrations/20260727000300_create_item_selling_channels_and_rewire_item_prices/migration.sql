CREATE TABLE "item_selling_channels" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "online_payment_tax_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_margin_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_marketplace" BOOLEAN NOT NULL DEFAULT false,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_selling_channels_pkey" PRIMARY KEY ("id")
);

INSERT INTO "item_selling_channels" (
    "id",
    "key",
    "name",
    "fee_amount",
    "tax_perc",
    "online_payment_tax_perc",
    "target_margin_perc",
    "is_marketplace",
    "sort_order_index"
)
SELECT
    "id",
    "key",
    "name",
    "fee_amount",
    "tax_perc",
    "online_payment_tax_perc",
    "target_margin_perc",
    "is_marketplace",
    "sort_order_index"
FROM "menu_item_selling_channels";

ALTER TABLE "item_selling_prices"
DROP CONSTRAINT "item_selling_prices_channel_id_fkey";

DROP INDEX "item_selling_prices_item_variation_channel_unique";
DROP INDEX "item_selling_prices_channel_id_idx";

ALTER TABLE "item_selling_prices"
ADD COLUMN "item_selling_channel_id" TEXT;

UPDATE "item_selling_prices"
SET "item_selling_channel_id" = "menu_item_selling_channel_id"
WHERE "item_selling_channel_id" IS NULL;

ALTER TABLE "item_selling_prices"
ALTER COLUMN "item_selling_channel_id" SET NOT NULL;

CREATE UNIQUE INDEX "item_selling_prices_item_variation_channel_unique"
ON "item_selling_prices"("item_variation_id", "item_selling_channel_id");

CREATE INDEX "item_selling_prices_channel_id_idx"
ON "item_selling_prices"("item_selling_channel_id");

ALTER TABLE "item_selling_prices"
ADD CONSTRAINT "item_selling_prices_channel_id_fkey"
FOREIGN KEY ("item_selling_channel_id") REFERENCES "item_selling_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "item_selling_prices"
DROP COLUMN "menu_item_selling_channel_id";
