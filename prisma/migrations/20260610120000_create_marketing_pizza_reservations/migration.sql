CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_pizza_reservations" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "size" TEXT,
    "combo_count" INTEGER NOT NULL DEFAULT 0,
    "delivery_zone_id" TEXT,
    "take_away" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "marketing_pizza_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_campaigns_key_key" ON "marketing_campaigns"("key");
CREATE INDEX "marketing_campaigns_validity_idx" ON "marketing_campaigns"("valid_from", "valid_to");
CREATE INDEX "marketing_campaigns_deleted_at_idx" ON "marketing_campaigns"("deleted_at");
CREATE UNIQUE INDEX "marketing_pizza_reservations_campaign_sequence_key" ON "marketing_pizza_reservations"("campaign_id", "sequence_number");
CREATE INDEX "marketing_pizza_reservations_campaign_deleted_idx" ON "marketing_pizza_reservations"("campaign_id", "deleted_at");
CREATE INDEX "marketing_pizza_reservations_delivery_zone_idx" ON "marketing_pizza_reservations"("delivery_zone_id");

ALTER TABLE "marketing_pizza_reservations"
ADD CONSTRAINT "marketing_pizza_reservations_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketing_pizza_reservations"
ADD CONSTRAINT "marketing_pizza_reservations_delivery_zone_id_fkey"
FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "marketing_campaigns" (
    "id",
    "key",
    "name",
    "valid_from",
    "valid_to"
)
VALUES (
    gen_random_uuid()::text,
    '2026-dia-dos-namorados',
    '[2026] Dia dos Namorados',
    TIMESTAMP '2026-06-01 00:00:00',
    TIMESTAMP '2026-06-12 23:59:59.999'
)
ON CONFLICT ("key") DO NOTHING;
