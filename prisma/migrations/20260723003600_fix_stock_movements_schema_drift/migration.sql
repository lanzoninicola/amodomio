DROP TABLE IF EXISTS "stock_nf_import_applied_changes" CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'source_batch_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE "stock_movements" RENAME COLUMN "source_batch_id" TO "import_batch_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'source_line_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'import_line_id'
  ) THEN
    ALTER TABLE "stock_movements" RENAME COLUMN "source_line_id" TO "import_line_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'rolled_back_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE "stock_movements" RENAME COLUMN "rolled_back_at" TO "deleted_at";
  END IF;
END
$$;

ALTER TABLE "stock_movements"
ADD COLUMN IF NOT EXISTS "direction" TEXT,
ADD COLUMN IF NOT EXISTS "movement_type" TEXT,
ADD COLUMN IF NOT EXISTS "origin_type" TEXT,
ADD COLUMN IF NOT EXISTS "origin_ref_id" TEXT,
ADD COLUMN IF NOT EXISTS "quantity_amount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "quantity_unit" TEXT,
ADD COLUMN IF NOT EXISTS "import_batch_id" TEXT,
ADD COLUMN IF NOT EXISTS "import_line_id" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

UPDATE "stock_movements"
SET
  "direction" = COALESCE("direction", 'entry'),
  "movement_type" = COALESCE("movement_type", 'import'),
  "origin_type" = COALESCE("origin_type", CASE WHEN "import_line_id" IS NOT NULL THEN 'import-line' ELSE NULL END),
  "origin_ref_id" = COALESCE("origin_ref_id", "import_line_id"),
  "quantity_amount" = COALESCE(
    "quantity_amount",
    NULLIF("metadata"->>'qtyEntry', '')::DOUBLE PRECISION,
    NULLIF("metadata"->>'qtyConsumption', '')::DOUBLE PRECISION
  ),
  "quantity_unit" = COALESCE(
    "quantity_unit",
    NULLIF("metadata"->>'movementUnit', ''),
    NULLIF("metadata"->>'targetUnit', '')
  );

ALTER TABLE "stock_movements"
ALTER COLUMN "direction" SET DEFAULT 'entry',
ALTER COLUMN "direction" SET NOT NULL,
ALTER COLUMN "movement_type" SET DEFAULT 'import',
ALTER COLUMN "movement_type" SET NOT NULL;

ALTER TABLE "stock_movements"
DROP COLUMN IF EXISTS "source_type",
DROP COLUMN IF EXISTS "rollback_status",
DROP COLUMN IF EXISTS "rollback_message";

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'stock_movements'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS %I', fk.conname);
  END LOOP;
END
$$;

DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'stock_movements'
      AND indexname <> 'stock_movements_pkey'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
  END LOOP;
END
$$;

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
