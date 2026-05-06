CREATE TABLE "item_cost_history" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "cost_amount" DOUBLE PRECISION NOT NULL,
  "unit" TEXT,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "reference_id" TEXT,
  "supplier_name" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_cost_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_cost_history_item_valid_from_idx" ON "item_cost_history"("item_id", "valid_from");
CREATE INDEX "item_cost_history_item_created_at_idx" ON "item_cost_history"("item_id", "created_at");

ALTER TABLE "item_cost_history"
ADD CONSTRAINT "item_cost_history_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
