CREATE TABLE "cost_impact_runs" (
  "id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_ref_id" TEXT,
  "source_item_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "affected_recipes" INTEGER NOT NULL DEFAULT 0,
  "affected_sheets" INTEGER NOT NULL DEFAULT 0,
  "affected_menu_items" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cost_impact_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cost_impact_menu_items" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "menu_item_size_id" TEXT,
  "menu_item_channel_id" TEXT,
  "current_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "previous_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "selling_price_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit_actual_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit_expected_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recommended_price_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price_gap_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "margin_gap_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priority" TEXT NOT NULL DEFAULT 'low',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cost_impact_menu_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cost_impact_runs_source_type_created_at_idx"
  ON "cost_impact_runs"("source_type", "created_at");
CREATE INDEX "cost_impact_runs_source_item_created_at_idx"
  ON "cost_impact_runs"("source_item_id", "created_at");
CREATE INDEX "cost_impact_menu_items_run_idx"
  ON "cost_impact_menu_items"("run_id");
CREATE INDEX "cost_impact_menu_items_item_created_at_idx"
  ON "cost_impact_menu_items"("menu_item_id", "created_at");
CREATE INDEX "cost_impact_menu_items_priority_created_at_idx"
  ON "cost_impact_menu_items"("priority", "created_at");

ALTER TABLE "cost_impact_runs"
  ADD CONSTRAINT "cost_impact_runs_source_item_id_fkey"
  FOREIGN KEY ("source_item_id") REFERENCES "items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cost_impact_menu_items"
  ADD CONSTRAINT "cost_impact_menu_items_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "cost_impact_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cost_impact_menu_items"
  ADD CONSTRAINT "cost_impact_menu_items_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cost_impact_menu_items"
  ADD CONSTRAINT "cost_impact_menu_items_menu_item_size_id_fkey"
  FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cost_impact_menu_items"
  ADD CONSTRAINT "cost_impact_menu_items_menu_item_channel_id_fkey"
  FOREIGN KEY ("menu_item_channel_id") REFERENCES "menu_item_selling_channels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
