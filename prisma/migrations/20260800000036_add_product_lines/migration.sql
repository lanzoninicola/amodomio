CREATE TABLE "product_lines" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_lines_key_key" ON "product_lines"("key");

INSERT INTO "product_lines" (
    "id",
    "key",
    "name",
    "description",
    "sort_order_index"
)
VALUES
    (gen_random_uuid()::text, 'pizza', 'Pizza', 'Linha atual de pizzas', 1000),
    (gen_random_uuid()::text, 'massa-fresca', 'Massa fresca', 'Massas frescas', 2000);

ALTER TABLE "item_groups" ADD COLUMN "product_line_id" TEXT;

UPDATE "item_groups"
SET "product_line_id" = (
    SELECT "id" FROM "product_lines" WHERE "key" = 'pizza'
);

ALTER TABLE "item_groups" ALTER COLUMN "product_line_id" SET NOT NULL;

CREATE INDEX "item_groups_product_line_id_idx" ON "item_groups"("product_line_id");

ALTER TABLE "item_groups"
ADD CONSTRAINT "item_groups_product_line_id_fkey"
FOREIGN KEY ("product_line_id") REFERENCES "product_lines"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_line_selling_channels" (
    "id" TEXT NOT NULL,
    "product_line_id" TEXT NOT NULL,
    "item_selling_channel_id" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_line_selling_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_line_selling_channels_line_channel_unique"
ON "product_line_selling_channels"("product_line_id", "item_selling_channel_id");

CREATE INDEX "product_line_selling_channels_channel_visible_idx"
ON "product_line_selling_channels"("item_selling_channel_id", "visible");

ALTER TABLE "product_line_selling_channels"
ADD CONSTRAINT "product_line_selling_channels_product_line_id_fkey"
FOREIGN KEY ("product_line_id") REFERENCES "product_lines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_line_selling_channels"
ADD CONSTRAINT "product_line_selling_channels_item_selling_channel_id_fkey"
FOREIGN KEY ("item_selling_channel_id") REFERENCES "item_selling_channels"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current behavior for every existing channel, then explicitly keep
-- Massa fresca hidden until it is enabled for a channel.
INSERT INTO "product_line_selling_channels" (
    "id",
    "product_line_id",
    "item_selling_channel_id",
    "visible"
)
SELECT
    gen_random_uuid()::text,
    product_line."id",
    channel."id",
    true
FROM "product_lines" product_line
CROSS JOIN "item_selling_channels" channel
WHERE product_line."key" = 'pizza';

INSERT INTO "product_line_selling_channels" (
    "id",
    "product_line_id",
    "item_selling_channel_id",
    "visible"
)
SELECT
    gen_random_uuid()::text,
    product_line."id",
    channel."id",
    false
FROM "product_lines" product_line
CROSS JOIN "item_selling_channels" channel
WHERE product_line."key" = 'massa-fresca';
