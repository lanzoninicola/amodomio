CREATE TABLE "item_selling_prices" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_variation_id" TEXT NOT NULL,
    "menu_item_selling_channel_id" TEXT NOT NULL,
    "price_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit_actual_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_expected_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit_expected_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "previous_price_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "item_selling_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_selling_prices_item_variation_channel_unique"
ON "item_selling_prices"("item_variation_id", "menu_item_selling_channel_id");

CREATE INDEX "item_selling_prices_item_id_idx"
ON "item_selling_prices"("item_id");

CREATE INDEX "item_selling_prices_channel_id_idx"
ON "item_selling_prices"("menu_item_selling_channel_id");

CREATE INDEX "item_selling_prices_published_idx"
ON "item_selling_prices"("published");

ALTER TABLE "item_selling_prices"
ADD CONSTRAINT "item_selling_prices_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_selling_prices"
ADD CONSTRAINT "item_selling_prices_item_variation_id_fkey"
FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_selling_prices"
ADD CONSTRAINT "item_selling_prices_channel_id_fkey"
FOREIGN KEY ("menu_item_selling_channel_id") REFERENCES "menu_item_selling_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
