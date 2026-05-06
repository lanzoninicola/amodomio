CREATE TABLE "stock_movement_cost_review_approvals" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "ingredient_name" TEXT NOT NULL,
    "mapped_item_id" TEXT,
    "mapped_item_name" TEXT,
    "target_unit" TEXT,
    "cost_amount" DOUBLE PRECISION,
    "converted_cost_amount" DOUBLE PRECISION,
    "last_cost_per_unit" DOUBLE PRECISION,
    "avg_cost_per_unit" DOUBLE PRECISION,
    "notified_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_cost_review_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movement_cost_review_approvals_batch_idx" ON "stock_movement_cost_review_approvals"("batch_id");
CREATE INDEX "stock_movement_cost_review_approvals_approved_at_idx" ON "stock_movement_cost_review_approvals"("approved_at");

ALTER TABLE "stock_movement_cost_review_approvals" ADD CONSTRAINT "stock_movement_cost_review_approvals_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_movement_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
