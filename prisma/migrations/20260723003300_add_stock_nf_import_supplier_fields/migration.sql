ALTER TABLE "stock_nf_import_batch_lines"
ADD COLUMN "supplier_id" TEXT,
ADD COLUMN "supplier_name" TEXT,
ADD COLUMN "supplier_name_normalized" TEXT,
ADD COLUMN "supplier_cnpj" TEXT,
ADD COLUMN "supplier_match_source" TEXT;

ALTER TABLE "stock_nf_import_applied_changes"
ADD COLUMN "supplier_id" TEXT,
ADD COLUMN "supplier_name" TEXT,
ADD COLUMN "supplier_cnpj" TEXT;

CREATE INDEX "stock_nf_import_batch_lines_supplier_idx"
ON "stock_nf_import_batch_lines"("supplier_id");

CREATE INDEX "stock_nf_import_applied_changes_supplier_idx"
ON "stock_nf_import_applied_changes"("supplier_id");

ALTER TABLE "stock_nf_import_batch_lines"
ADD CONSTRAINT "stock_nf_import_batch_lines_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_nf_import_applied_changes"
ADD CONSTRAINT "stock_nf_import_applied_changes_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
