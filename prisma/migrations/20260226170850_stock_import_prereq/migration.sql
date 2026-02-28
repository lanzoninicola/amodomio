-- Pre-req migration for stock import chain.
-- Purpose: make shadow DB reproducible without editing already-applied migrations.

CREATE TABLE IF NOT EXISTS stock_nf_import_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'saipos',
  source_type TEXT NOT NULL DEFAULT 'entrada_nf',
  status TEXT NOT NULL DEFAULT 'draft',
  original_file_name TEXT,
  worksheet_name TEXT,
  period_start TIMESTAMP(3),
  period_end TIMESTAMP(3),
  uploaded_by TEXT,
  applied_at TIMESTAMP(3),
  rolled_back_at TIMESTAMP(3),
  summary JSONB,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS stock_nf_import_batch_lines (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'parsed',
  error_code TEXT,
  error_message TEXT,
  raw_data JSONB,
  movement_at TIMESTAMP(3),
  ingredient_name TEXT NOT NULL,
  ingredient_name_normalized TEXT NOT NULL,
  motivo TEXT,
  identification TEXT,
  invoice_number TEXT,
  qty_entry DOUBLE PRECISION,
  unit_entry TEXT,
  qty_consumption DOUBLE PRECISION,
  unit_consumption TEXT,
  movement_unit TEXT,
  cost_amount DOUBLE PRECISION,
  cost_total_amount DOUBLE PRECISION,
  observation TEXT,
  source_fingerprint TEXT NOT NULL,
  duplicate_of_line_id TEXT,
  mapped_item_id TEXT,
  mapped_item_name TEXT,
  mapping_source TEXT,
  manual_conversion_factor DOUBLE PRECISION,
  conversion_source TEXT,
  conversion_factor_used DOUBLE PRECISION,
  target_unit TEXT,
  converted_cost_amount DOUBLE PRECISION,
  applied_at TIMESTAMP(3),
  rolled_back_at TIMESTAMP(3),
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_nf_import_applied_changes (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_variation_id TEXT NOT NULL,
  previous_cost_variation_id TEXT,
  previous_cost_amount DOUBLE PRECISION,
  previous_cost_unit TEXT,
  new_cost_amount DOUBLE PRECISION NOT NULL,
  new_cost_unit TEXT,
  movement_unit TEXT,
  conversion_source TEXT,
  conversion_factor_used DOUBLE PRECISION,
  invoice_number TEXT,
  movement_at TIMESTAMP(3),
  applied_by TEXT,
  applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rolled_back_at TIMESTAMP(3),
  rollback_status TEXT,
  rollback_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_import_aliases (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'saipos',
  source_type TEXT NOT NULL DEFAULT 'entrada_nf',
  alias_name TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  item_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Constraint helpers to keep this migration idempotent in production.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_batch_lines_batch_id_fkey') THEN
    ALTER TABLE stock_nf_import_batch_lines
      ADD CONSTRAINT stock_nf_import_batch_lines_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES stock_nf_import_batches(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_batch_lines_mapped_item_id_fkey') THEN
    ALTER TABLE stock_nf_import_batch_lines
      ADD CONSTRAINT stock_nf_import_batch_lines_mapped_item_id_fkey
      FOREIGN KEY (mapped_item_id) REFERENCES items(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_applied_changes_batch_id_fkey') THEN
    ALTER TABLE stock_nf_import_applied_changes
      ADD CONSTRAINT stock_nf_import_applied_changes_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES stock_nf_import_batches(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_applied_changes_line_id_fkey') THEN
    ALTER TABLE stock_nf_import_applied_changes
      ADD CONSTRAINT stock_nf_import_applied_changes_line_id_fkey
      FOREIGN KEY (line_id) REFERENCES stock_nf_import_batch_lines(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_applied_changes_item_id_fkey') THEN
    ALTER TABLE stock_nf_import_applied_changes
      ADD CONSTRAINT stock_nf_import_applied_changes_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES items(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_nf_import_applied_changes_item_variation_id_fkey') THEN
    ALTER TABLE stock_nf_import_applied_changes
      ADD CONSTRAINT stock_nf_import_applied_changes_item_variation_id_fkey
      FOREIGN KEY (item_variation_id) REFERENCES item_variations(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_import_aliases_item_id_fkey') THEN
    ALTER TABLE item_import_aliases
      ADD CONSTRAINT item_import_aliases_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES items(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stock_nf_import_batches_status_created_at_idx
  ON stock_nf_import_batches(status, created_at);
