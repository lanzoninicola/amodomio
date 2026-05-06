DROP TABLE IF EXISTS "stock_nf_import_applied_changes" CASCADE;
DROP TABLE IF EXISTS "stock_movements" CASCADE;

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'entry',
  "movement_type" TEXT NOT NULL DEFAULT 'import',
  "origin_type" TEXT,
  "origin_ref_id" TEXT,
  "import_batch_id" TEXT,
  "import_line_id" TEXT,
  "item_id" TEXT NOT NULL,
  "item_variation_id" TEXT NOT NULL,
  "supplier_id" TEXT,
  "quantity_amount" DOUBLE PRECISION,
  "quantity_unit" TEXT,
  "previous_cost_variation_id" TEXT,
  "previous_cost_amount" DOUBLE PRECISION,
  "previous_cost_unit" TEXT,
  "new_cost_amount" DOUBLE PRECISION NOT NULL,
  "new_cost_unit" TEXT,
  "movement_unit" TEXT,
  "conversion_source" TEXT,
  "conversion_factor_used" DOUBLE PRECISION,
  "invoice_number" TEXT,
  "supplier_name" TEXT,
  "supplier_cnpj" TEXT,
  "movement_at" TIMESTAMP(3),
  "applied_by" TEXT,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_origin_type_ref_idx"
ON "stock_movements"("origin_type", "origin_ref_id");

CREATE INDEX "stock_movements_import_batch_idx"
ON "stock_movements"("import_batch_id");

CREATE INDEX "stock_movements_import_line_idx"
ON "stock_movements"("import_line_id");

CREATE INDEX "stock_movements_direction_idx"
ON "stock_movements"("direction");

CREATE INDEX "stock_movements_type_idx"
ON "stock_movements"("movement_type");

CREATE INDEX "stock_movements_item_idx"
ON "stock_movements"("item_id");

CREATE INDEX "stock_movements_item_variation_idx"
ON "stock_movements"("item_variation_id");

CREATE INDEX "stock_movements_supplier_idx"
ON "stock_movements"("supplier_id");

CREATE INDEX "stock_movements_deleted_at_idx"
ON "stock_movements"("deleted_at");

CREATE INDEX "stock_movements_movement_applied_at_idx"
ON "stock_movements"("movement_at", "applied_at");

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_import_batch_id_fkey"
FOREIGN KEY ("import_batch_id") REFERENCES "stock_nf_import_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_import_line_id_fkey"
FOREIGN KEY ("import_line_id") REFERENCES "stock_nf_import_batch_lines"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_item_variation_id_fkey"
FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
