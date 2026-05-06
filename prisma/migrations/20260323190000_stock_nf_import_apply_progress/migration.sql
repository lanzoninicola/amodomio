ALTER TABLE stock_nf_import_batches
  ADD COLUMN apply_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN apply_started_at TIMESTAMP(3),
  ADD COLUMN apply_finished_at TIMESTAMP(3),
  ADD COLUMN apply_processed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN apply_error_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN apply_total_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN apply_message TEXT;
