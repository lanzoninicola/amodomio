-- Add scope to measurement_units (global = visible to all, restricted = only linked items)
ALTER TABLE "measurement_units" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'global';

-- CreateTable
CREATE TABLE "item_units" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_units_item_id_idx" ON "item_units"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_units_item_id_unit_code_key" ON "item_units"("item_id", "unit_code");

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "measurement_units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
