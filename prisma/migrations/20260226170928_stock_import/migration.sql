-- DropForeignKey
ALTER TABLE "item_import_aliases" DROP CONSTRAINT "item_import_aliases_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_applied_changes" DROP CONSTRAINT "stock_nf_import_applied_changes_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_applied_changes" DROP CONSTRAINT "stock_nf_import_applied_changes_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_applied_changes" DROP CONSTRAINT "stock_nf_import_applied_changes_item_variation_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_applied_changes" DROP CONSTRAINT "stock_nf_import_applied_changes_line_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_batch_lines" DROP CONSTRAINT "stock_nf_import_batch_lines_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_nf_import_batch_lines" DROP CONSTRAINT "stock_nf_import_batch_lines_mapped_item_id_fkey";

-- DropIndex
DROP INDEX "stock_nf_import_batches_status_created_at_idx";

-- CreateIndex
CREATE INDEX "stock_nf_import_batches_status_created_at_idx" ON "stock_nf_import_batches"("status", "created_at");

-- AddForeignKey
ALTER TABLE "stock_nf_import_batch_lines" ADD CONSTRAINT "stock_nf_import_batch_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_nf_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_nf_import_batch_lines" ADD CONSTRAINT "stock_nf_import_batch_lines_mapped_item_id_fkey" FOREIGN KEY ("mapped_item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_nf_import_applied_changes" ADD CONSTRAINT "stock_nf_import_applied_changes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_nf_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_nf_import_applied_changes" ADD CONSTRAINT "stock_nf_import_applied_changes_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "stock_nf_import_batch_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_nf_import_applied_changes" ADD CONSTRAINT "stock_nf_import_applied_changes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_nf_import_applied_changes" ADD CONSTRAINT "stock_nf_import_applied_changes_item_variation_id_fkey" FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_import_aliases" ADD CONSTRAINT "item_import_aliases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
