DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stock_nf_import_batches'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
  ) THEN
    ALTER TABLE "stock_nf_import_batches" RENAME TO "stock_movement_import_batches";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stock_nf_import_batch_lines'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batch_lines'
  ) THEN
    ALTER TABLE "stock_nf_import_batch_lines" RENAME TO "stock_movement_import_batch_lines";
  END IF;
END $$;

ALTER TABLE IF EXISTS "stock_movement_import_batches"
  RENAME CONSTRAINT "stock_nf_import_batches_pkey" TO "stock_movement_import_batches_pkey";

ALTER TABLE IF EXISTS "stock_movement_import_batch_lines"
  RENAME CONSTRAINT "stock_nf_import_batch_lines_pkey" TO "stock_movement_import_batch_lines_pkey";

ALTER TABLE IF EXISTS "stock_movement_import_batch_lines"
  RENAME CONSTRAINT "stock_nf_import_batch_lines_batch_id_fkey" TO "stock_movement_import_batch_lines_batch_id_fkey";

ALTER TABLE IF EXISTS "stock_movement_import_batch_lines"
  RENAME CONSTRAINT "stock_nf_import_batch_lines_mapped_item_id_fkey" TO "stock_movement_import_batch_lines_mapped_item_id_fkey";

ALTER TABLE IF EXISTS "stock_movement_import_batch_lines"
  RENAME CONSTRAINT "stock_nf_import_batch_lines_supplier_id_fkey" TO "stock_movement_import_batch_lines_supplier_id_fkey";

ALTER INDEX IF EXISTS "stock_nf_import_batches_status_created_at_idx"
  RENAME TO "stock_movement_import_batches_status_created_at_idx";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_batch_row_unique"
  RENAME TO "stock_movement_import_batch_lines_batch_row_unique";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_batch_fingerprint_unique"
  RENAME TO "stock_movement_import_batch_lines_batch_fingerprint_unique";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_batch_status_idx"
  RENAME TO "stock_movement_import_batch_lines_batch_status_idx";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_ingredient_norm_idx"
  RENAME TO "stock_movement_import_batch_lines_ingredient_norm_idx";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_fingerprint_idx"
  RENAME TO "stock_movement_import_batch_lines_fingerprint_idx";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_mapped_item_idx"
  RENAME TO "stock_movement_import_batch_lines_mapped_item_idx";

ALTER INDEX IF EXISTS "stock_nf_import_batch_lines_supplier_idx"
  RENAME TO "stock_movement_import_batch_lines_supplier_idx";

UPDATE "stock_movement_import_batch_lines"
SET "status" = 'imported'
WHERE "status" = 'applied';

UPDATE "stock_movement_import_batches"
SET "status" = 'imported'
WHERE "status" = 'applied';
