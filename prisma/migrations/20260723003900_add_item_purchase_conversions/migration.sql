-- CreateTable
CREATE TABLE "item_purchase_conversions" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "purchase_um" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_purchase_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_purchase_conversions_item_id_idx" ON "item_purchase_conversions"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_purchase_conversions_item_id_purchase_um_key" ON "item_purchase_conversions"("item_id", "purchase_um");

-- AddForeignKey
ALTER TABLE "item_purchase_conversions" ADD CONSTRAINT "item_purchase_conversions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MigrateExistingData: copy existing single conversions to the new table
INSERT INTO "item_purchase_conversions" ("id", "item_id", "purchase_um", "factor")
SELECT gen_random_uuid(), id, purchase_um, purchase_to_consumption_factor
FROM "items"
WHERE purchase_um IS NOT NULL
  AND purchase_to_consumption_factor IS NOT NULL
  AND purchase_to_consumption_factor > 0;
