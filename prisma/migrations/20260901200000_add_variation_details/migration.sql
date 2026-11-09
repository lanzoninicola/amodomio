CREATE TABLE "variation_details" (
    "id" TEXT NOT NULL,
    "variation_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "variation_details_variation_id_key_unique"
ON "variation_details"("variation_id", "key");

CREATE INDEX "variation_details_key_idx" ON "variation_details"("key");

ALTER TABLE "variation_details"
ADD CONSTRAINT "variation_details_variation_id_fkey"
FOREIGN KEY ("variation_id") REFERENCES "variations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
