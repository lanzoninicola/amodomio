-- CreateTable: item_cost_variations_history_audit
-- Audit trail for changes to ItemCostVariationHistory records.
-- Each row records a before/after snapshot when a history record is updated in-place.

CREATE TABLE "item_cost_variations_history_audit" (
    "id" TEXT NOT NULL,
    "history_record_id" TEXT NOT NULL,
    "item_variation_id" TEXT NOT NULL,
    "cost_amount_before" DOUBLE PRECISION NOT NULL,
    "cost_amount_after" DOUBLE PRECISION NOT NULL,
    "unit_before" TEXT,
    "unit_after" TEXT,
    "source_before" TEXT,
    "source_after" TEXT,
    "valid_from_before" TIMESTAMP(3) NOT NULL,
    "valid_from_after" TIMESTAMP(3) NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cost_variations_history_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_cost_var_history_audit_history_record_id_idx" ON "item_cost_variations_history_audit"("history_record_id");

-- CreateIndex
CREATE INDEX "item_cost_var_history_audit_item_var_created_at_idx" ON "item_cost_variations_history_audit"("item_variation_id", "created_at");

-- AddForeignKey
ALTER TABLE "item_cost_variations_history_audit" ADD CONSTRAINT "item_cost_variations_history_audit_history_record_id_fkey" FOREIGN KEY ("history_record_id") REFERENCES "item_cost_variations_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;
