ALTER TABLE "stock_nf_import_batches"
ADD COLUMN "supplier_notes_file_name" TEXT,
ADD COLUMN "supplier_notes_attached_at" TIMESTAMP(3);

ALTER TABLE "stock_nf_import_batch_lines"
ADD COLUMN "supplier_reconciliation_status" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN "supplier_reconciliation_source" TEXT,
ADD COLUMN "supplier_reconciliation_at" TIMESTAMP(3);

UPDATE "stock_nf_import_batch_lines"
SET
  "supplier_reconciliation_status" = CASE
    WHEN "supplier_id" IS NOT NULL THEN 'matched'
    WHEN COALESCE("supplier_name", '') <> '' OR COALESCE("supplier_cnpj", '') <> '' THEN 'unmatched'
    ELSE 'not_started'
  END,
  "supplier_reconciliation_source" = CASE
    WHEN "supplier_id" IS NOT NULL THEN COALESCE("supplier_match_source", 'legacy')
    WHEN COALESCE("supplier_name", '') <> '' OR COALESCE("supplier_cnpj", '') <> '' THEN COALESCE("supplier_match_source", 'legacy_unmatched')
    ELSE NULL
  END,
  "supplier_reconciliation_at" = CASE
    WHEN "supplier_id" IS NOT NULL OR COALESCE("supplier_name", '') <> '' OR COALESCE("supplier_cnpj", '') <> '' THEN NOW()
    ELSE NULL
  END
WHERE
  "supplier_reconciliation_status" = 'not_started';
