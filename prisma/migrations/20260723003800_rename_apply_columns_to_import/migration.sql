DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_status'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_status" TO "import_status";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_started_at'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_started_at" TO "import_started_at";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_finished_at'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_finished_at" TO "import_finished_at";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_processed_count'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_processed_count" TO "import_processed_count";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_error_count'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_error_count" TO "import_error_count";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_total_count'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_total_count" TO "import_total_count";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movement_import_batches'
      AND column_name = 'apply_message'
  ) THEN
    ALTER TABLE "stock_movement_import_batches" RENAME COLUMN "apply_message" TO "import_message";
  END IF;
END $$;

UPDATE "stock_movement_import_batches"
SET "import_status" = 'importing'
WHERE "import_status" = 'applying';

UPDATE "stock_movement_import_batches"
SET "import_status" = 'imported'
WHERE "import_status" = 'completed';
